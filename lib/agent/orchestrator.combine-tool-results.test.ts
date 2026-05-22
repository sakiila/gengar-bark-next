process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

const { Orchestrator } = require('./orchestrator');

describe('Orchestrator combineToolResults', () => {
  it('does not create Slack blocks for string tool data', () => {
    const orchestrator = new Orchestrator(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        formatTextResponse: (text: string) => text,
        formatStructuredResponse: () => [{ type: 'section' }],
      } as any,
      { cache: { enabled: false, defaultTtlSeconds: 1 } },
      { logExecution: jest.fn() } as any
    );

    const longText = `{"features":[${'x'.repeat(5000)}]}`;
    const response = (orchestrator as any).combineToolResults(
      [
        {
          toolName: 'growthbook_get_feature_flags',
          result: {
            success: true,
            data: longText,
            displayText: longText,
          },
        },
      ],
      ['growthbook_get_feature_flags']
    );

    expect(response.blocks).toBeUndefined();
    expect(response.text).toBe(longText);
  });
});
