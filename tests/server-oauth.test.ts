// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {createApp} from '../server/index.ts';
it('binds OAuth to the browser session, consumes state once and does not persist access tokens',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:'private-provider-token'}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({id:'provider-user-123',name:'Chosen alias'}),{status:200}));
  const app=createApp({database:':memory:',origin:'http://game.test',facebookId:'example-id',facebookSecret:'example-secret',fetcher:fetcher as typeof fetch});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const address=app.server.address() as any,url=`http://127.0.0.1:${address.port}`;
  try{
    const session=await fetch(url+'/api/session'),cookie=session.headers.get('set-cookie')!.split(';')[0];expect(cookie).toMatch(/^casino_session=/);expect(session.headers.get('set-cookie')).toContain('HttpOnly');
    const start=await fetch(url+'/api/oauth/facebook/start',{headers:{cookie},redirect:'manual'});expect(start.status).toBe(302);const location=new URL(start.headers.get('location')!),state=location.searchParams.get('state')!;expect(location.hostname).toBe('www.facebook.com');expect(location.searchParams.get('client_secret')).toBeNull();
    const stolen=await fetch(url+'/api/oauth/facebook/callback?code=code&state='+state,{redirect:'manual'});expect(stolen.status).toBe(403);expect(fetcher).not.toHaveBeenCalled();
    const secondStart=await fetch(url+'/api/oauth/facebook/start',{headers:{cookie},redirect:'manual'}),state2=new URL(secondStart.headers.get('location')!).searchParams.get('state')!;
    const success=await fetch(url+'/api/oauth/facebook/callback?code=code&state='+state2,{headers:{cookie},redirect:'manual'});expect(success.status).toBe(302);const signedCookie=success.headers.get('set-cookie')!.split(';')[0];const profile=await (await fetch(url+'/api/session',{headers:{cookie:signedCookie}})).json() as any;expect(profile.user.provider).toBe('facebook');expect(profile.user.displayName).toBe('Chosen alias');expect(JSON.stringify(app.store.db.prepare('SELECT * FROM users').all())).not.toContain('private-provider-token');
    const replay=await fetch(url+'/api/oauth/facebook/callback?code=code&state='+state2,{headers:{cookie},redirect:'manual'});expect(replay.status).toBe(403);expect(fetcher).toHaveBeenCalledTimes(2);
  }finally{await new Promise<void>(r=>app.server.close(()=>r()));}
});
