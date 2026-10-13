import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyZip, crc32 } from '../scripts/zip.mjs';

// Offline fake ZIP fixtures; actual Git archive and rebuild are a separate release gate.
function zip(entries) {
  const locals=[],central=[];let offset=0;
  for(const [name,bytes,mode=0x8000] of entries) {
    const filename=Buffer.from(name); const crc=crc32(bytes);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(bytes.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(filename.length,26);
    locals.push(local,filename,bytes);
    const dir=Buffer.alloc(46);dir.writeUInt32LE(0x02014b50);dir.writeUInt16LE(0x0314,4);dir.writeUInt16LE(20,6);dir.writeUInt32LE(crc,16);dir.writeUInt32LE(bytes.length,20);dir.writeUInt32LE(bytes.length,24);dir.writeUInt16LE(filename.length,28);dir.writeUInt32LE((mode<<16)>>>0,38);dir.writeUInt32LE(offset,42);central.push(dir,filename);offset+=local.length+filename.length+bytes.length;
  }
  const data=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(data.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,data,end]);
}
const bytes=Buffer.from('FAKE_OFFLINE_SOURCE'),expected=new Map([['source.mjs',bytes]]);
test('ZIP verifies exact full bytes, CRC and allowlist',()=> {const result=verifyZip(zip([['source.mjs',bytes]]),expected);assert.equal(result.files.size,1);assert.equal(result.manifest[0].bytes,bytes.length);});
test('ZIP rejects traversal/absolute/backslash/duplicate/symlink/missing and blob corruption before extraction',()=> {
  for(const name of ['../source.mjs','/source.mjs','C:/source.mjs','x\\source.mjs','other.mjs']) assert.throws(()=>verifyZip(zip([[name,bytes]]),expected));
  assert.throws(()=>verifyZip(zip([['source.mjs',bytes],['source.mjs',bytes]]),expected));
  assert.throws(()=>verifyZip(zip([['source.mjs',bytes,0xa000]]),expected));
  assert.throws(()=>verifyZip(zip([]),expected));
  assert.throws(()=>verifyZip(zip([['source.mjs',Buffer.from('FAKE_OTHER')]]),expected));
  const bad=zip([['source.mjs',bytes]]);bad[30+'source.mjs'.length]^=1;assert.throws(()=>verifyZip(bad,expected));
});
