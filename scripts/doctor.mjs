import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';

const db = new DatabaseSync(':memory:');
console.log('Node:', process.version);
console.log('Platform:', process.platform, process.arch);
console.log('SQLite:', db.prepare('SELECT sqlite_version() AS version').get().version);
db.close();
for (const [command, args] of [['git', ['--version']], ['java', ['-version']], ['adb', ['version']], ['docker', ['--version']]]) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true });
  console.log(`${command}: ${result.error ? 'unavailable in PATH' : (result.stdout || result.stderr).trim()}`);
}
console.log('ANDROID_HOME:', process.env.ANDROID_HOME || 'not configured');
console.log('Native iOS compilation:', process.platform === 'darwin' ? 'check Xcode separately' : 'requires macOS/Xcode');
console.log('AI: disabled by default; doctor does not read or expose credentials.');
