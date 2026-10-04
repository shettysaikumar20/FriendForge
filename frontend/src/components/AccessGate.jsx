import React, { useEffect, useState } from 'react';
const API = import.meta.env.VITE_API_BASE_URL || '';
export default function AccessGate({ children }) {
  const [session,setSession]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [password,setPassword]=useState('');
  async function check(){
    setError('');
    try {const response=await fetch(API+'/api/session',{credentials:'include'});if(!response.ok)throw new Error();setSession(await response.json());}
    catch{setError('Cannot connect to FriendForge. Please retry.');}
  }
  useEffect(()=>{
    check();const expired=()=>setSession({authenticated:false,passwordRequired:true});
    window.addEventListener('friendforge:signin',expired);
    return()=>window.removeEventListener('friendforge:signin',expired);
  },[]);
  async function signIn(event){
    event.preventDefault();if(busy)return;setBusy(true);setError('');
    try{
      const response=await fetch(API+'/api/session',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      const data=await response.json();if(!response.ok)throw new Error(data.message || 'Sign-in failed.');
      setPassword('');await check();
    }catch(err){setError(err.message || 'Could not connect. Please retry.');}finally{setBusy(false);}
  }
  if(session?.authenticated)return <>
    {session.passwordRequired && <div className="access-toolbar"><button className="browse-btn" onClick={async()=>{
      try {const response=await fetch(API+'/api/session',{method:'DELETE',credentials:'include'});if(response.ok)setSession({authenticated:false,passwordRequired:true});else setError('Could not sign out. Please retry.');}catch{setError('Could not sign out. Please retry.');}
    }}>Lock study space</button>{error && <p role="alert">{error}</p>}</div>}
    {children}
  </>;
  return <main className="access-page forge-card">
    <h1>FriendForge</h1><p>A private study space for a friend.</p>
    {session ? <form onSubmit={signIn}>
      <label htmlFor="study-password">Shared study password</label>
      <input id="study-password" className="chat-input" type="password" autoComplete="current-password" maxLength={256} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/>
      <button className="browse-btn" disabled={busy}>{busy?'Signing in...':'Open study space'}</button>
    </form> : !error && <p role="status">Connecting...</p>}
    {error && <p role="alert">{error}</p>}
    {!session && error && <button className="browse-btn" onClick={check}>Retry connection</button>}
  </main>;
}
