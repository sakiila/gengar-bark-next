import {
  Content,
  Part,
  Tool as GeminiTool,
} from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";
import dotenv from "dotenv";
import { spawn } from "child_process";
import { GoogleGenAI } from '@google/genai';
import { FunctionDeclaration } from '@google/genai/dist/web/web';

dotenv.config();

// --- Define MCP Tool Schema Type ---
// Ensure this matches the OpenAPI v3 schema subset expected by Gemini
interface McpInputSchema {
  type: "object";
  properties: {
    [key: string]: {
      type: string;
      description?: string;
      // Add other OpenAPI properties if needed
    };
  };
  required?: string[];
}

class MCPClient {
  private mcp: Client;
  private genAI: GoogleGenAI;
  private geminiTools: FunctionDeclaration[] = [];
  private transport: StdioClientTransport | null = null;
  private serverProcess: import('child_process').ChildProcess | null = null; // Store server process

  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY environment variable is not set.");
    }
    this.genAI = new GoogleGenAI({ apiKey: 'AIzaSyABU163a4KRlL2uwlViOrR_JYvA0LK8ggQ' });

    this.mcp = new Client({
      name: "mcp-gemini-client-latest",
      version: "1.1.0" // Bump version potentially
    });
  }

  async connectToServer() {
    try {
      console.log("启动 Datadog MCP Server...");
      this.serverProcess = spawn("npx", ["-y", "@winor30/mcp-server-datadog"], {
        env: {
          ...process.env,
          DATADOG_API_KEY: process.env.DATADOG_API_KEY || '', // Ensure keys are present
          DATADOG_APP_KEY: process.env.DATADOG_APP_KEY || '',
          DATADOG_SITE: process.env.DATADOG_SITE || "us5.datadoghq.com"
        },
        stdio: ['pipe', 'pipe', 'inherit'] // Pipe stdin/stdout, inherit stderr for logs
      });

      this.serverProcess.on('error', (err) => {
        console.error('启动 MCP 服务器进程失败:', err);
        throw err;
      });
      this.serverProcess.on('exit', (code, signal) => {
        console.warn(`MCP Server process exited with code ${code}, signal ${signal}`);
        // Handle unexpected exit if necessary
        this.transport = null; // Mark transport as unusable
      });

      if (!this.serverProcess.stdin || !this.serverProcess.stdout) {
        throw new Error("Failed to get stdin/stdout from server process.");
      }

      this.transport = new StdioClientTransport({
        input: this.serverProcess.stdout,
        output: this.serverProcess.stdin
      });

      console.log("连接到 MCP 服务器...");
      this.mcp.connect(this.transport);

      console.log("从 MCP 服务器获取可用工具...");
      const toolsResult = await this.mcp.listTools();

      if (toolsResult && toolsResult.tools && toolsResult.tools.length > 0) {
        this.geminiTools = toolsResult.tools.map((tool) => {
          // Filter the parameters to exclude not supported keys
          const parameters = Object.fromEntries(
            Object.entries(tool.inputSchema).filter(([key]) => !['additionalProperties', '$schema'].includes(key)),
          );
          return {
            name: tool.name,
            description: tool.description,
            parameters: parameters,
          };
        });
        console.log("已连接并转换工具:", this.geminiTools.map(t => t.name).join(", ") || "无");
      } else {
        console.log("已连接到服务器，但未找到可用工具或工具列表为空。");
      }

    } catch (e) {
      console.error("连接 MCP 服务器或处理工具时出错:", e);
      await this.cleanup(); // Attempt cleanup on connection error
      throw e;
    }
  }

  /**
   * Processes a user query, interacts with the Gemini model (streaming),
   * handles function calls via MCP, and streams the response.
   *
   * @param query The user's input query.
   * @param streamCallback A function to call with each text chunk received from the model.
   */
  async processQuery(
    query: string,
    streamCallback: (chunkText: string) => void
  ): Promise<void> {
    const history: Content[] = [{ role: "user", parts: [{ text: query }] }];
    let processingComplete = false;
    let safetyBlocked = false; // Flag for safety issues

    try {
      while (!processingComplete && !safetyBlocked) {
        console.log(`\n[调用 Gemini API，包含 ${history.length} 条历史记录]`);
        const streamResult = await this.genAI.models.generateContentStream({
          contents: history,
          model: 'gemini-2.0-flash',
          // tools: this.geminiTools.length > 0 ? this.geminiTools : undefined,
          // toolConfig: this.geminiTools.length > 0 ? { functionCallingConfig: { mode: FunctionCallingMode.AUTO } } : undefined,
          config: {
            tools: [{
              functionDeclarations: this.geminiTools,
            }],
          },
        });

        let currentModelResponseParts: Part[] = []; // Accumulate parts for history
        let functionCallsDetected: any[] = []; // Store function calls from this turn's stream

        // Process the stream chunk by chunk
        for await (const chunk of streamResult) {
          // --- Check for errors/blocking in the chunk ---
          if (chunk.promptFeedback?.blockReason) {
            console.error(`请求被阻止: ${chunk.promptFeedback.blockReason}`, chunk.promptFeedback.safetyRatings);
            streamCallback(`\n[请求因安全原因被阻止: ${chunk.promptFeedback.blockReason}]`);
            safetyBlocked = true;
            break; // Stop processing this stream
          }
          if (!chunk.candidates || chunk.candidates.length === 0) {
            const finishReason = chunk.candidates?.[0]?.finishReason;
            if(finishReason && finishReason !== "STOP" ) {
              console.warn(`Stream chunk has no valid candidates. Finish Reason: ${finishReason}`);
              streamCallback(`\n[警告: 模型回复异常 (${finishReason})]`);
            } else {
              // Might just be an empty chunk, continue processing
              // console.debug("Empty chunk received in stream");
            }
            continue;
          }

          const candidate = chunk.candidates[0];
          if(candidate.finishReason === "SAFETY") {
            console.error("回复因安全原因被阻止:", candidate.safetyRatings);
            streamCallback("\n[回复因安全原因被阻止]");
            safetyBlocked = true;
            break; // Stop processing this stream
          }
          // --- Process valid content parts ---
          const chunkParts = candidate?.content?.parts;
          if (!chunkParts) continue; // Skip if no parts in this chunk

          for (const part of chunkParts) {
            if (part.text) {
              streamCallback(part.text); // Stream text immediately
              currentModelResponseParts.push(part); // Add text part for history
            } else if (part.functionCall) {
              // Note: Function calls usually arrive as a complete part at the end.
              // We accumulate them here.
              console.log(`[流中检测到函数调用请求: ${part.functionCall.name}]`);
              functionCallsDetected.push(part.functionCall);
              // Add the *entire* part containing the function call to the history later
              currentModelResponseParts.push(part);
            }
          }
        } // End stream processing for one turn

        if (safetyBlocked) break; // Exit loop if blocked

        // --- Add the *complete* model response (text + function call requests) to history ---
        if (currentModelResponseParts.length > 0) {
          history.push({ role: 'model', parts: currentModelResponseParts });
        } else if (functionCallsDetected.length === 0 && !safetyBlocked) {
          // If the stream ended without error, function calls, or text, maybe log it.
          console.warn("Model turn ended with no text or function calls.");
          // This might indicate the conversation reached a natural end or an issue.
        }


        // --- Process any detected function calls ---
        if (functionCallsDetected.length > 0) {
          streamCallback(`\n[需要调用工具: ${functionCallsDetected.map(fc => fc.name).join(', ')}]`);
          const functionResponseParts: Part[] = [];

          for (const functionCall of functionCallsDetected) {
            const toolName = functionCall.name;
            const toolArgs = functionCall.args || {};
            streamCallback(`\n  [正在调用 MCP 工具: ${toolName}...]`);
            console.log(`[调用 MCP 工具: ${toolName}, 参数: ${JSON.stringify(toolArgs)}]`);

            try {
              const toolResult = await this.mcp.callTool(toolName, toolArgs);
              const resultStr = JSON.stringify(toolResult?.content);
              console.log(`[工具 ${toolName} 返回: ${resultStr}]`);
              streamCallback(` [完成]`);

              functionResponseParts.push({
                functionResponse: {
                  name: toolName,
                  response: {
                    // Ensure content is serializable (object, string, etc.)
                    content: toolResult?.content ?? {} // Provide default if null/undefined
                  }
                }
              });
            } catch (e) {
              const errorMsg = e instanceof Error ? e.message : String(e);
              console.error(`执行工具 ${toolName} 时出错:`, errorMsg);
              streamCallback(` [错误: ${errorMsg}]`);
              functionResponseParts.push({
                functionResponse: {
                  name: toolName,
                  response: { error: `执行工具失败: ${errorMsg}` } // Inform model
                }
              });
            }
          } // End for loop processing function calls

          // Add function responses to history for the next turn
          history.push({ role: "function", parts: functionResponseParts });
          streamCallback(`\n[工具结果已准备好，正在发送给 Gemini...]\n`);
          // The loop will continue, sending the updated history back to the model
        } else {
          // No function calls in this turn, generation is complete
          processingComplete = true;
        }
      } // End while(!processingComplete && !safetyBlocked)

      if (!safetyBlocked) {
        streamCallback("\n[对话结束]"); // Signal normal completion
      }

    } catch (error) {
      console.error("处理查询或与 Gemini API 交互时出错:", error);
      streamCallback(`\n[处理查询时发生错误: ${error instanceof Error ? error.message : String(error)}]`);
      // Consider more specific error handling based on error type if needed
    }
  }


  async chatLoop() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log("\nMCP Datadog (Gemini Latest) 客户端已启动!");
    console.log("输入查询或输入 'quit' 退出");

    while (true) {
      const query = await rl.question("\n你: ");
      if (query.toLowerCase() === "quit") break;
      if (!query.trim()) continue; // Skip empty input

      try {
        process.stdout.write("\nGemini: "); // Start the response line
        // Define the callback to handle streamed text chunks
        const streamCallback = (chunkText: string) => {
          process.stdout.write(chunkText); // Write chunk directly to stdout
        };
        // Call processQuery, which now handles streaming and tool calls internally
        await this.processQuery(query, streamCallback);
        // The final "[完成]" or error message from processQuery adds the last newline

      } catch (e) {
        // Catch unexpected errors not handled within processQuery
        console.error("\n处理查询时发生顶层错误:", e);
        process.stdout.write(`\n[错误: ${e instanceof Error ? e.message : '未知错误'}]\n`);
      }
    }

    rl.close();
  }

  async cleanup() {
    console.log("开始清理...");
    if (this.mcp) {
      try {
        console.log("关闭与 MCP 服务器的连接...");
        await this.mcp.close();
        console.log("MCP 连接已关闭。");
      } catch (e) {
        console.error("关闭 MCP 连接时出错:", e);
      }
    } else {
      console.log("MCP 连接已关闭或未初始化。");
    }

    if (this.serverProcess) {
      console.log("正在终止 MCP 服务器进程...");
      const killed = this.serverProcess.kill(); // Send SIGTERM
      console.log(`服务器进程终止尝试: ${killed ? '成功' : '失败'}`);
      this.serverProcess = null;
    } else {
      console.log("MCP 服务器进程未运行或未跟踪。");
    }
    this.transport = null;
  }
}

// --- 主函数 ---
async function main() {
  // Add signal handling for graceful shutdown
  let client: MCPClient | null = null;
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`\n接收到 ${signal}。正在关闭...`);
    if (client) {
      await client.cleanup();
    }
    process.exit(0);
  };

  signals.forEach(signal => {
    process.on(signal, () => shutdown(signal));
  });


  try {
    client = new MCPClient();
    await client.connectToServer();
    await client.chatLoop();
  } catch (error) {
    console.error("客户端启动或运行时遇到不可恢复的错误:", error);
    if (client) {
      await client.cleanup(); // Attempt cleanup even on error
    }
    process.exit(1); // Exit with error code
  } finally {
    console.log("主函数执行完毕。");
    // Ensure cleanup runs if chatLoop finishes normally (e.g., user types 'quit')
    if (client && !process.exitCode) { // Check if already exiting due to error or signal
      await client.cleanup();
    }
  }
}

main().catch(e => {
  // Catch errors not handled by the main try/catch/finally
  console.error("未捕获的顶层错误:", e);
  process.exit(1);
});
