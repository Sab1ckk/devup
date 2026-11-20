import {afterEach,describe,expect,it,vi} from 'vitest';
import {api} from '../lib/api';
afterEach(()=>vi.unstubAllGlobals());
describe('admin API transport',()=>{
 it('sends PUT JSON with CSRF header',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:true})});vi.stubGlobal('fetch',fetch);
  await api('/admin/services/site',{price_from:null},{method:'PUT'});
  const [url,options]=fetch.mock.calls[0];expect(url).toBe('/api/admin/services/site');expect(options.method).toBe('PUT');expect(options.headers['X-Requested-With']).toBe('devup');expect(JSON.parse(options.body).price_from).toBeNull();
 });
 it('keeps multipart boundary managed by browser',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({media_id:'test'})});vi.stubGlobal('fetch',fetch);
  const data=new FormData();data.append('file',new Blob(['image']),'test.png');await api('/admin/media',data);
  const options=fetch.mock.calls[0][1];expect(options.headers['Content-Type']).toBeUndefined();expect(options.headers['X-Requested-With']).toBe('devup');expect(options.body).toBe(data);
 });
 it('notifies guard when admin session expires',async()=>{
  const listener=vi.fn();window.addEventListener('devup-admin-expired',listener);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:401,headers:new Headers(),json:async()=>({message:'Сессия истекла'})}));
  await expect(api('/admin/requests')).rejects.toMatchObject({status:401,message:'Сессия истекла'});expect(listener).toHaveBeenCalledOnce();window.removeEventListener('devup-admin-expired',listener);
 });
});
