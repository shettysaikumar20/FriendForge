const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
process.env.DATA_DIR=path.join(__dirname,'../temp/registry-test');const registry=require('../src/services/documentRegistry');
test('sources map only actual filenames within their thread',()=>{
 registry.register({id:'doc1',threadId:'a',name:'DBMS_Unit_3.pdf',internalName:'note-123.pdf'});
 assert.deepEqual(registry.sourceNames(['note-123.pdf'],'a'),['DBMS_Unit_3.pdf']);
 assert.deepEqual(registry.sourceNames(['note-123.pdf'],'b'),['note-123.pdf']);
 assert.deepEqual(registry.sourceNames(['../../unknown.txt',{},'../../unknown.txt'],'a'),['unknown.txt']);
 fs.unlinkSync(path.join(process.env.DATA_DIR,'documents.json'));
});
