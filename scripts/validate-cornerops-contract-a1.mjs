import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const contractPath = new URL('../contracts/cornermex-cornerops-boundary-v1.json', import.meta.url);
const migrationPath = new URL('../supabase/migrations/20260713222315_revoke_public_rls_auto_enable_execution.sql', import.meta.url);
const expectedContractSha = 'b87acfbdeac1427e141677616a0d8fbda5ecabc10a4c84012a9bd5d8bc98249a';

const contractRaw = await readFile(contractPath);
const contract = JSON.parse(contractRaw);
const contractSha = createHash('sha256').update(contractRaw).digest('hex');
if (contractSha !== expectedContractSha) throw new Error('A1 boundary contract checksum mismatch.');
if (contract.systems.cornermex !== 'commerce_system_of_record') throw new Error('CornerMex ownership boundary changed.');
if (contract.writePolicies.corneropsDirectDatabaseWrite !== 'blocked') throw new Error('CornerOps write boundary changed.');

const migration = (await readFile(migrationPath, 'utf8')).toLowerCase();
for (const forbidden of ['insert ', 'update ', 'delete ', 'truncate ', 'drop ', 'alter table', 'create table']) {
  if (migration.includes(forbidden)) throw new Error(`Security migration contains forbidden operation: ${forbidden.trim()}`);
}
for (const role of ['public', 'anon', 'authenticated']) {
  if (!migration.includes(`from ${role}`)) throw new Error(`Security migration does not revoke ${role}.`);
}
if (!migration.includes('revoke execute on function public.rls_auto_enable()')) {
  throw new Error('Security migration does not target public.rls_auto_enable().');
}

console.log(JSON.stringify({ status: 'alignment_a1_valid', contractVersion: contract.contractVersion, contractSha256: contractSha }));
