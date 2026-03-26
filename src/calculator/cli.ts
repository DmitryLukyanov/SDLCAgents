import { parseArgs } from './calculator.js';

const argv = process.argv.slice(2);
const result = parseArgs(argv);

if (result.ok) {
  console.log(result.value);
  process.exit(0);
} else {
  console.error(`Error: ${result.error}`);
  process.exit(1);
}
