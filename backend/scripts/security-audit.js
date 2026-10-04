// Prints paths/counts only; never credential values or matching lines.
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'../..');
const dotenv=require('dotenv');const envPath=path.join(root,'backend/.env');const env=fs.existsSync(envPath)?dotenv.parse(fs.readFileSync(envPath)):{};
const secrets=Object.entries({...env,...process.env}).filter(([name,value])=>/^(BACKBOARD_API_KEY|APP_PASSWORD)$/.test(name)&&value&&value.length>=8).map(([,value])=>Buffer.from(value));
let scanned=0;const issues=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);if(entry.isSymbolicLink())continue;if(entry.isDirectory()){walk(file);continue;}
 if(file===envPath)continue;let bytes;try{bytes=fs.readFileSync(file);}catch{issues.push({file:path.relative(root,file),reason:'unreadable'});continue;}scanned++;
 if(secrets.some(secret=>bytes.includes(secret)))issues.push({file:path.relative(root,file),reason:'credential value found'});
 if(file.startsWith(path.join(root,'frontend','src'))&&/VITE_BACKBOARD_API_KEY/.test(bytes.toString()))issues.push({file:path.relative(root,file),reason:'forbidden frontend credential variable'});
}}
walk(root);console.log(JSON.stringify({scannedFiles:scanned,credentialValuesChecked:secrets.length,issues},null,2));if(issues.length)process.exitCode=1;
