import { GoogleGenAI } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// 主函数 (与之前相同)
export async function run_mcp() {
// Create server parameters for stdio connection
  const serverParams = new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@winor30/mcp-server-datadog'],

  });

  const client = new Client(
    {
      name: 'mcp-gengar-client',
      version: '1.0.0',
    },
  );

// Configure the client
  const ai = new GoogleGenAI({ apiKey: 'AIzaSyABU163a4KRlL2uwlViOrR_JYvA0LK8ggQ' });

// Initialize the connection between client and server
  await client.connect(serverParams);

// Get tools from MCP session and convert to Gemini Tool objects
  const mcpTools = await client.listTools();
  const tools = mcpTools.tools.map((tool) => {
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

// Send request to the model with MCP function declarations
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'Retrieve a list of incidents from Datadog on 2025-04-15',
    config: {
      tools: [{
        functionDeclarations: tools,
      }],
    },
  });

// Check for function calls in the response
  if (response.functionCalls && response.functionCalls.length > 0) {
    const functionCall = response.functionCalls[0]; // Assuming one function call
    console.log(`Function to call: ${functionCall.name}`);
    console.log(`Arguments: ${JSON.stringify(functionCall.args)}`);
    // Call the MCP server with the predicted tool
    const result = await client.callTool({ name: functionCall.name as string, arguments: functionCall.args });
    // @ts-ignore
    console.log(result.content[0].text);
    // Continue as shown in step 4 of "How Function Calling Works"
    // and create a user friendly response
  } else {
    console.log('No function call found in the response.');
    console.log(response.text);
  }

// Close the connection
  await client.close();
}
