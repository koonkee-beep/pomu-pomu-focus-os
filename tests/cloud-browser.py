"""Offline integration tests: real UI and fetch, mocked Supabase auth/REST only.
Run from repository root: python tests/cloud-browser.py (Playwright + Chromium).
No emails are sent and no hosted accounts are created.
"""
import copy, http.server, json, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright

A='11111111-1111-4111-8111-111111111111';B='22222222-2222-4222-8222-222222222222'
BASE='http://127.0.0.1:8780'
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
class Backend:
 def __init__(self):
  self.rows={};self.tokens={'token-A':A,'token-B':B};self.refreshes={'refresh-A':A,'refresh-B':B};self.offline=False;self.hold_write=False;self.held=None;self.setup=True;self.writes=0
 def user(self,uid):return {'id':uid,'email':'owner@example.com' if uid==A else 'sister@example.com'}
 def session(self,uid):
  suffix='A' if uid==A else 'B';return {'access_token':'token-'+suffix,'refresh_token':'refresh-'+suffix,'expires_in':3600,'user':self.user(uid)}
 def route(self,route):
  req=route.request;path=req.url.split('.supabase.co',1)[1];body=req.post_data_json if req.post_data else {};uid=self.tokens.get(req.headers.get('authorization','').removeprefix('Bearer '))
  assert req.headers.get('apikey','').startswith('sb_publishable_')
  if self.offline:route.abort('internetdisconnected');return
  if self.hold_write and '/rpc/' in path:self.held=(route,uid,copy.deepcopy(body));self.hold_write=False;return
  def respond(data,status=200):route.fulfill(status=status,json=data)
  if path.startswith('/auth/v1/token'):
   if 'refresh_token' in path:actor=self.refreshes.get(body.get('refresh_token'))
   else:actor=A if body.get('email')=='owner@example.com' else B if body.get('email')=='sister@example.com' else None
   if actor and (body.get('password')=='test-password' or 'refresh_token' in path):respond(self.session(actor))
   else:respond({'message':'bad credentials'},400)
  elif path.startswith('/auth/v1/signup'):respond({'user':self.user(A)})
  elif path.startswith('/auth/v1/recover'):respond({})
  elif path.startswith('/auth/v1/user'):
   respond(self.user(uid)) if uid else respond({},401)
  elif path.startswith('/auth/v1/logout'):respond({})
  elif path.startswith('/rest/v1/'):
   if not uid:respond({},401);return
   if not self.setup:respond({'code':'PGRST205'},404);return
   if '/rpc/' in path:self.write(route,uid,body)
   else:respond([copy.deepcopy(self.rows[uid])] if uid in self.rows else [])
  else:respond({},404)
 def write(self,route,uid,body):
  row=self.rows.get(uid);rev=row['revision'] if row else 0
  if body['p_expected_revision']!=rev:route.fulfill(json=None);return
  self.writes+=1;self.rows[uid]={'payload':copy.deepcopy(body['p_payload']),'revision':rev+1};route.fulfill(json=rev+1)

def run():
 server=http.server.ThreadingHTTPServer(('127.0.0.1',8780),Quiet);threading.Thread(target=server.serve_forever,daemon=True).start();backend=Backend();results=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  errors=[]
  def context():
   ctx=browser.new_context(accept_downloads=True);ctx.route('https://ohbrkopbdfpetwemarnr.supabase.co/**',backend.route);return ctx
  def page_in(ctx):
   page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE);page.evaluate("go('settings')");return page
  def login(page,email='owner@example.com'):
   page.locator('#cloudEmail').fill(email);page.locator('#cloudPassword').fill('test-password');page.get_by_role('button',name='Sign in',exact=True).click();page.wait_for_function("PomuSync.isSignedIn()");page.wait_for_function("!document.getElementById('cloudSyncNow').disabled")
  def sync(page):
   if not page.locator('#settings').is_visible():page.evaluate("go('settings')")
   page.locator('#cloudSyncNow').click();page.wait_for_function("!document.getElementById('cloudSyncNow').disabled || !document.getElementById('cloudConflict').hidden");page.wait_for_timeout(100)
  def add(page,title):page.evaluate('(title)=>addTask(title)',title)
  def titles(page):return page.evaluate('db.tasks.map(t=>t.title)')
  def check(name,test):assert test,name;results.append(name)
  laptop=context();l=page_in(laptop)
  # Signed-out app continues to write only the legacy local key.
  add(l,'Existing local task');guest=l.evaluate("localStorage.getItem('kikiFocusOS')")
  check('Local-only tasks work without a cloud request',backend.writes==0)
  login(l);check('Sign-in does not upload or display guest tasks',titles(l)==[] and backend.writes==0)
  l.locator('#cloudLocalCopy').click();l.wait_for_function("document.getElementById('cloudStatus').textContent.includes('Synced')")
  check('Explicit migration retains original guest storage',l.evaluate("localStorage.getItem('kikiFocusOS')")==guest and 'Existing local task' in titles(l))
  phone=context();f=page_in(phone);login(f)
  check('Same account loads the same tasks on another device',titles(f)==titles(l))
  add(l,'Laptop edit');sync(l);sync(f);check('Saved laptop changes reach phone', 'Laptop edit' in titles(f))
  # Keep a draft in one device; it must not be replaced by the polling read.
  f.evaluate("document.getElementById('tomorrowAnchor').value='Unsaved draft'")
  add(l,'Remote while typing');sync(l);sync(f)
  check('Remote updates do not clobber unsaved drafts',f.locator('#tomorrowAnchor').input_value()=='Unsaved draft' and 'Remote while typing' not in titles(f))
  f.evaluate("document.getElementById('tomorrowAnchor').value=db.anchor");sync(f)
  check('Remote update applies after draft is finished','Remote while typing' in titles(f))
  # Stale concurrent writes never silently replace the newer snapshot.
  add(l,'Laptop concurrent');sync(l);add(f,'Phone concurrent');sync(f)
  check('Concurrent write raises conflict without overwriting cloud',f.locator('#cloudConflict').is_visible() and 'Laptop concurrent' in [t['title'] for t in backend.rows[A]['payload']['tasks']] and 'Phone concurrent' not in [t['title'] for t in backend.rows[A]['payload']['tasks']])
  f.on('dialog',lambda d:d.accept())
  with f.expect_download():f.locator('#cloudUseLocal').click()
  f.wait_for_function("document.getElementById('cloudStatus').textContent.includes('Synced')")
  check('Explicit conflict choice saves with backup','Phone concurrent' in [t['title'] for t in backend.rows[A]['payload']['tasks']])
  sync(l);check('Other device receives resolved list','Phone concurrent' in titles(l))
  # Offline pending changes are preserved across reload and reconnect.
  backend.offline=True;add(f,'Offline phone edit');sync(f)
  check('Offline save is cached and shows connection status','offline' in f.locator('#cloudStatus').inner_text().lower() and f.evaluate("Object.keys(localStorage).some(k=>k.startsWith('pomuCloudCache:')&&JSON.parse(localStorage[k]).dirty)"))
  f.reload();f.wait_for_timeout(150);backend.offline=False;f.reload();f.evaluate("go('settings')");f.wait_for_function("PomuSync.isSignedIn()");f.wait_for_function("document.getElementById('cloudStatus').textContent.includes('Synced')")
  check('Pending edits survive reload and reconnect','Offline phone edit' in titles(f))
  # Independent account and sign-out preserve the guest list.
  l.locator('#cloudSignOut').click();check('Sign-out restores the exact original local list',l.evaluate("localStorage.getItem('kikiFocusOS')")==guest and 'Laptop edit' not in titles(l))
  login(l,'sister@example.com');check('Sister sees an empty independent account',titles(l)==[])
  add(l,'Sister private task');sync(l);check('Sister edits never enter owner account','Sister private task' not in [t['title'] for t in backend.rows[A]['payload']['tasks']])
  # Multi-tab signout must not leak data or clear a different account's login.
  tab=page_in(laptop);tab.wait_for_function('PomuSync.isSignedIn()');l.locator('#cloudSignOut').click();tab.wait_for_function('!PomuSync.isSignedIn()')
  login(l);tab.wait_for_timeout(100)
  check('Cross-tab account switch does not erase the new session',l.evaluate("JSON.parse(localStorage.pomuCloudSession).user.id")==A and l.evaluate('PomuSync.isSignedIn()'))
  # A late write response for A cannot mutate B after an account switch.
  backend.hold_write=True;add(l,'Delayed owner write');l.wait_for_timeout(800);check('Write request held for race test',backend.held is not None)
  l.locator('#cloudSignOut').click();login(l,'sister@example.com');held,uid,body=backend.held;backend.write(held,uid,body);backend.held=None;l.wait_for_timeout(200)
  check('Late old-account response cannot leak into new account',titles(l)==['Sister private task'])
  # Pending cache from a closed tab is discoverable on a new tab after sign-in.
  backend.offline=True;add(l,'Closed tab pending');l.wait_for_timeout(800);backend.offline=False;l.close();fresh=page_in(laptop);fresh.wait_for_function('PomuSync.isSignedIn()');fresh.wait_for_function("!document.getElementById('cloudSyncNow').disabled")
  check('Closed-tab pending edits are recoverable',fresh.locator('#cloudPending').is_visible())
  fresh.on('dialog',lambda d:d.accept())
  with fresh.expect_download():fresh.locator('#cloudPendingRestore').click()
  fresh.wait_for_function("document.getElementById('cloudStatus').textContent.includes('Synced')")
  check('Recovering closed-tab pending edits syncs safely','Closed tab pending' in titles(fresh))
  # Expired sessions refresh using only the refresh token.
  fresh.evaluate("(()=>{const s=JSON.parse(localStorage.pomuCloudSession);s.expires_at=1;localStorage.pomuCloudSession=JSON.stringify(s)})()");fresh.reload();fresh.wait_for_function('PomuSync.isSignedIn()')
  check('Expired session refresh restores verified account',fresh.locator('#cloudAccount').inner_text().endswith('sister@example.com'))
  # Setup errors are visible; no guest data is uploaded as a fallback.
  backend.setup=False;setupctx=context();setup=page_in(setupctx);login(setup);setup.wait_for_function("document.getElementById('cloudStatus').textContent.includes('setup')")
  check('Missing database setup is explained',setup.locator('#cloudStatus').inner_text().find('setup')>=0)
  backend.setup=True
  # Normal signup and reset requests are mocked: no emails are sent.
  signupctx=context();signup=page_in(signupctx)
  signup.locator('#cloudEmail').fill('new@example.com');signup.locator('#cloudPassword').fill('test-password');signup.locator('#cloudSignUp').click()
  signup.wait_for_function("document.getElementById('cloudStatus').textContent.includes('confirm')")
  check('Signup waits for confirmation without uploading guest data',not signup.evaluate('PomuSync.isSignedIn()') and signup.locator('#cloudPassword').input_value()=='')
  signup.locator('#cloudRecover').click();signup.wait_for_function("document.getElementById('cloudStatus').textContent.includes('If that account exists')")
  check('Reset request works without a password and does not enumerate users',not signup.evaluate('PomuSync.isSignedIn()'))
  # A newer cloud list can also be chosen explicitly over pending edits.
  backend.rows[B]['revision']+=1;backend.rows[B]['payload']['anchor']='Newer cloud anchor'
  add(fresh,'Discardable pending task');sync(fresh);check('Second conflict is visible',fresh.locator('#cloudConflict').is_visible())
  with fresh.expect_download():fresh.locator('#cloudUseRemote').click()
  fresh.wait_for_function("document.getElementById('cloudConflict').hidden")
  check('Use cloud copy downloads local backup before replacement','Discardable pending task' not in titles(fresh) and fresh.evaluate('db.anchor')=='Newer cloud anchor')
  # The user ID in persisted session metadata is never trusted as ownership.
  spoofctx=context();spoof=backend.session(A);spoof['user']=backend.user(B);spoof['expires_at']=int(time.time())+3600
  spoofctx.add_init_script("localStorage.setItem('pomuCloudSession',"+json.dumps(json.dumps(spoof))+")")
  spoofpage=page_in(spoofctx);spoofpage.wait_for_function('PomuSync.isSignedIn()');spoofpage.wait_for_function("!document.getElementById('cloudSyncNow').disabled")
  check('Ownership comes from verified Auth response, not stored user metadata','owner@example.com' in spoofpage.locator('#cloudAccount').inner_text() and 'Sister private task' not in titles(spoofpage))
  # A browser storage failure must not turn guest data into a cloud upload.
  quota=context();q=page_in(quota);q.evaluate("()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')}}")
  q.locator('#cloudEmail').fill('owner@example.com');q.locator('#cloudPassword').fill('test-password');q.get_by_role('button',name='Sign in',exact=True).click();q.wait_for_function("document.getElementById('cloudStatus').textContent.includes('Quota')")
  check('Session persistence failure leaves guest mode intact',not q.evaluate('PomuSync.isSignedIn()'))
  # Recovery callback is verified, stripped from URL, then allows password update.
  recoverctx=context();r=recoverctx.new_page();r.goto(BASE+'/#access_token=token-A&refresh_token=refresh-A&type=recovery&expires_in=3600');r.wait_for_function("!document.getElementById('cloudRecovery').hidden")
  check('Recovery tokens are removed from browser address','#' not in r.url)
  r.locator('#cloudNewPassword').fill('new-test-password');r.get_by_role('button',name='Update password',exact=True).click();r.wait_for_function("document.getElementById('cloudStatus').textContent.includes('Password updated')")
  check('Verified recovery session can change password',r.locator('#cloudRecovery').is_hidden())
  # Cloud data is validated/escaped, rather than becoming script in the app.
  check('Unsafe task fields are rejected',r.evaluate("!PomuSync.validList({...db,tasks:[{...db.tasks[0],id:'1);alert(1)//'}]})"))
  r.evaluate("db.inbox=[{id:99,text:'safe',type:'<img src=x onerror=alert(1)>',processed:true}];renderInbox()")
  check('Inbox type renders as text',r.locator('#inboxList img').count()==0)
  # Existing category/task/timer/appearance and layout behaviour still works.
  r.evaluate("db.inbox=[];go('tasks');document.getElementById('newCategoryName').value='Synced custom';addCategory();addTask('Custom task','Synced custom');setDue(db.tasks.find(t=>t.title==='Custom task').id,'2026-12-31')")
  check('Custom categories and editable due dates survive sync mode',r.evaluate("db.tasks.some(t=>t.project==='Synced custom'&&t.due==='2026-12-31')"))
  r.evaluate("go('focus');launchImmersiveFocus();toggleImmersiveTimer()");r.wait_for_timeout(1100);check('Existing focus timer counts down',r.evaluate('seconds<1500'));r.evaluate('toggleImmersiveTimer();exitImmersiveFocus()')
  r.evaluate("setPomuAppearance('cozy');go('settings')")
  for width in [1440,390,320]:
   r.set_viewport_size({'width':width,'height':1000});check(f'Account form fits {width}px',r.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   Path('work/screenshots').mkdir(parents=True,exist_ok=True);r.screenshot(path=f'work/screenshots/cloud-account-{width}.png',full_page=True)
  check('No JavaScript page errors',not errors)
  browser.close()
 server.shutdown()
 Path('work/cloud-test-results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
if __name__=='__main__':run()
