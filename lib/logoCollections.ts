export type LogoCollection = {
  id: string;
  label: string;
  words: string[];
};

// Open logo catalog: all TryElements logos from the public index at
// https://www.tryelements.dev/r/logos-index.json (206 slugs). Embedded here
// so the game never depends on a runtime fetch or a small fallback catalog.
export const LOGO_CATALOG: string[] = [
  "ably","agentmail","algolia","amp","anthropic","antigravity","apple","astro","auth0","aws-amplify",
  "aws-api-gateway","aws-appsync","aws-athena","aws-bedrock","aws-cloudformation","aws-cloudfront","aws-cloudwatch","aws-codebuild","aws-codecommit","aws-codedeploy",
  "aws-codepipeline","aws-cognito","aws-dynamodb","aws-ec2","aws-ecs","aws-eks","aws-elastic-beanstalk","aws-eventbridge","aws-fargate","aws-glue",
  "aws-iam","aws-kinesis","aws-kms","aws-lambda","aws","aws-rds","aws-redshift","aws-route53","aws-s3","aws-sagemaker",
  "aws-secrets-manager","aws-sns","aws-sqs","aws-step-functions","aws-vpc","axiom","bash","beincrypto","better-auth","biome",
  "braintrust","browser-use","browserbase","bun","bytedance","cerebras","claude-code","claude","clerk","cline",
  "cloudflare","cloudinary","codex","cohere","composio","continue","convex","cplusplus","crafter-station","css",
  "cursor","datadog","daytona","deepl","deepseek","dify","discord","docker","drizzle","e2b",
  "elevenlabs","exa","expo","fal","figma","fireworks","flyio","gemini","ghostty","github-copilot",
  "github","gitlab","go","google","goose","grafana","grok","groq","html","hugging-face",
  "hyperbrowser","inngest","instagram","java","javascript","json","kapso","kebo","kilo-code","kimi",
  "kite","kotlin","langchain","langfuse","launchdarkly","linear","linkedin","lovable","luma","meilisearch",
  "mem0","meta","microsoft","mistral","modal","mongodb","moonshot-ai","n8n","neon","nextjs",
  "nodejs","notion","npm","nvidia","obsidian","ollama","openai","opencode","openhands","pagerduty",
  "payload","perplexity","pika","planetscale","pnpm","polar","postgresql","posthog","prisma","python",
  "qwen","railway","raycast","react","redis","render","replicate","replit","resend","roo-code",
  "ruby","runway","rust","sambanova","sanity","sentry","sixtyfour","slack","snowflake","spotify",
  "spring-boot","sql","stability","storybook","stripe","stytch","suno","supabase","svelte","swift",
  "tailwindcss","terraform","threads","tinte","together","trae","trigger","turso","twilio","twitch",
  "twitter","typescript","uploadthing","upstash","v0","vapi","vercel","vite","vuejs","windsurf",
  "workos","xai","xata","yarn","zed","zep",
];

// TryElements official logo collections extracted from the live RSC payload at
// https://www.tryelements.dev/docs/logos?view=collections.
// Each collection maps to a subset of the 206-slug LOGO_CATALOG.
// When multiple collections are selected, memberships are deduplicated.
// "open" (Catalogo abierto) is the mutually exclusive default: all 206 logos.
export const LOGO_COLLECTIONS: LogoCollection[] = [
  {
    id: "agentic-coding",
    label: "Agentic Coding",
    words: [
      "claude","opencode","cursor","openai","windsurf","gemini","cline","roo-code","continue","github-copilot",
      "github","openhands","goose","kilo-code","trae","claude-code","codex","replit","amp","antigravity",
    ],
  },
  {
    id: "ai-services",
    label: "AI Services",
    words: [
      "openai","anthropic","claude","gemini","mistral","cohere","deepseek","qwen","moonshot-ai","hugging-face",
      "groq","grok","perplexity","xai","kimi","ollama","replicate","together","fireworks","cerebras",
      "sambanova","stability","langchain","dify","luma","runway","pika","suno",
    ],
  },
  {
    id: "aws-all",
    label: "AWS All Services",
    words: [
      "aws","aws-ec2","aws-s3","aws-lambda","aws-rds","aws-dynamodb","aws-cloudfront","aws-route53","aws-iam","aws-vpc",
      "aws-cloudwatch","aws-sqs","aws-sns","aws-api-gateway","aws-ecs","aws-eks","aws-fargate","aws-elastic-beanstalk","aws-amplify","aws-appsync",
      "aws-cognito","aws-secrets-manager","aws-kms","aws-kinesis","aws-glue","aws-athena","aws-redshift","aws-sagemaker","aws-bedrock","aws-step-functions",
      "aws-eventbridge","aws-cloudformation","aws-codebuild","aws-codepipeline","aws-codecommit","aws-codedeploy",
    ],
  },
  {
    id: "cloud-infrastructure",
    label: "Cloud & Infrastructure",
    words: [
      "aws","supabase","upstash","stripe","resend","better-auth","clerk","polar","snowflake",
    ],
  },
  {
    id: "developer-tools",
    label: "Developer Tools & Platforms",
    words: [
      "github","gitlab","vercel","linear","notion","v0","lovable","trigger","n8n","deepl",
    ],
  },
  {
    id: "package-managers",
    label: "Package Managers",
    words: [
      "bun","npm","pnpm","yarn",
    ],
  },
  {
    id: "programming-languages",
    label: "Programming Languages",
    words: [
      "javascript","typescript","python","rust","go","html","css","json","bash","sql",
      "java","cplusplus","ruby","swift","kotlin",
    ],
  },
  {
    id: "social-media",
    label: "Social Media & Communication",
    words: [
      "twitter","discord","slack","twitch","spotify",
    ],
  },
  {
    id: "tech-giants",
    label: "Tech Giants",
    words: [
      "apple","microsoft","google","meta","nvidia","bytedance",
    ],
  },
];
