import { runDummyTicketAgent } from './dummy-agent.js';

runDummyTicketAgent().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
