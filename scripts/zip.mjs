import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { assertDirectory } from './validation.mjs';

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for(let bit=0;bit<8;bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function verifyZip(archive, expected) {
  if(!Buffer.isBuffer(archive) || archive.length > 10000000 || archive.length < 22 || !(expected instanceof Map)) throw new Error('INVALID_ZIP');
  let end = -1;
  for(let offset=archive.length-22;offset>=Math.max(0,archive.length-65557);offset--) {
    if(archive.readUInt32LE(offset) === 0x06054b50 && offset+22+archive.readUInt16LE(offset+20) === archive.length) { end=offset; break; }
  }
  if(end<0 || archive.readUInt16LE(end+4)!==0 || archive.readUInt16LE(end+6)!==0 || archive.readUInt16LE(end+8)!==archive.readUInt16LE(end+10)) throw new Error('INVALID_ZIP_DIRECTORY');
  const entries = archive.readUInt16LE(end+10);
  const centralSize = archive.readUInt32LE(end+12);
  const centralOffset = archive.readUInt32LE(end+16);
  if(entries>200 || centralOffset+centralSize!==end) throw new Error('INVALID_ZIP_DIRECTORY');
  const allowedDirectories = new Set();
  for(const name of expected.keys()) {
    const parts=name.split('/');
    for(let i=1;i<parts.length;i++) allowedDirectories.add(parts.slice(0,i).join('/')+'/');
  }
  const seen = new Set();
  const files = new Map();
  let offset=centralOffset;
  let total=0;
  for(let entry=0;entry<entries;entry++) {
    if(offset+46>end || archive.readUInt32LE(offset)!==0x02014b50) throw new Error('INVALID_ZIP_ENTRY');
    const flags=archive.readUInt16LE(offset+8), method=archive.readUInt16LE(offset+10);
    const crc=archive.readUInt32LE(offset+16), compressed=archive.readUInt32LE(offset+20), size=archive.readUInt32LE(offset+24);
    const nameLength=archive.readUInt16LE(offset+28), extra=archive.readUInt16LE(offset+30), comment=archive.readUInt16LE(offset+32);
    const mode=(archive.readUInt32LE(offset+38)>>>16)&0xf000;
    const local=archive.readUInt32LE(offset+42);
    if(offset+46+nameLength+extra+comment>end || (flags & ~0x808)!==0 || ![0,8].includes(method) || size>1000000 || (mode!==0 && mode!==0x8000 && mode!==0x4000)) throw new Error('UNSAFE_ZIP_ENTRY');
    const name=new TextDecoder('utf-8',{fatal:true}).decode(archive.subarray(offset+46,offset+46+nameLength));
    offset+=46+nameLength+extra+comment;
    if(!name || name.includes('\\') || name.startsWith('/') || name.includes(':') || name.split('/').some(x=>x==='..'||x==='.') || seen.has(name)) throw new Error('UNSAFE_ZIP_PATH');
    seen.add(name);
    const directory=name.endsWith('/');
    if(directory ? !allowedDirectories.has(name) || size!==0 : !expected.has(name) || mode===0x4000) throw new Error('ZIP_ALLOWLIST');
    if(local+30>centralOffset || archive.readUInt32LE(local)!==0x04034b50 || archive.readUInt16LE(local+6)!==flags || archive.readUInt16LE(local+8)!==method) throw new Error('INVALID_LOCAL_HEADER');
    const localNameLength=archive.readUInt16LE(local+26), localExtra=archive.readUInt16LE(local+28);
    const start=local+30+localNameLength+localExtra;
    if(start+compressed>centralOffset || archive.subarray(local+30,local+30+localNameLength).toString('utf8')!==name) throw new Error('INVALID_LOCAL_HEADER');
    if(!(flags & 8) && (archive.readUInt32LE(local+14)!==crc || archive.readUInt32LE(local+18)!==compressed || archive.readUInt32LE(local+22)!==size)) throw new Error('INVALID_LOCAL_HEADER');
    const encoded=archive.subarray(start,start+compressed);
    const bytes=method===8 ? inflateRawSync(encoded,{maxOutputLength:1000000}) : Buffer.from(encoded);
    total+=bytes.length;
    if(bytes.length!==size || total>5000000 || crc32(bytes)!==crc) throw new Error('ZIP_BYTES_OR_CRC');
    if(!directory) {
      if(!bytes.equals(expected.get(name))) throw new Error('ZIP_GIT_BLOB_MISMATCH');
      files.set(name,bytes);
    }
  }
  if(offset!==end || files.size!==expected.size) throw new Error('ZIP_MISSING_FILE');
  return {files,archiveBytes:archive.length,archiveSha256:hash(archive),manifest:Array.from(files,([name,bytes])=>({path:name,bytes:bytes.length,sha256:hash(bytes)})).sort((a,b)=>a.path.localeCompare(b.path,'en'))};
}
export async function unpackVerifiedZip(archive,expected,destination) {
  const result=verifyZip(archive,expected); // Validate ALL entries before creating the output directory.
  await assertDirectory(path.dirname(destination));
  try { await lstat(destination); throw new Error('EXTRACTION_TARGET_EXISTS'); }
  catch(error) { if(error.code!=='ENOENT') throw error; }
  await mkdir(destination);
  await assertDirectory(destination);
  for(const [name,bytes] of result.files) {
    const target=path.join(destination,...name.split('/'));
    if(!target.startsWith(destination+path.sep)) throw new Error('EXTRACTION_CONTAINMENT');
    await mkdir(path.dirname(target),{recursive:true});
    await assertDirectory(path.dirname(target));
    await writeFile(target,bytes,{flag:'wx'});
  }
  return {archiveBytes:result.archiveBytes,archiveSha256:result.archiveSha256,manifest:result.manifest};
}
