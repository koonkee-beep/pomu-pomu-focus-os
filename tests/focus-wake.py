"""Wake-lock lifecycle in real Chromium with a controllable platform mock.
Run from repository root: python tests/focus-wake.py
"""
import threading,http.server,json
from playwright.sync_api import sync_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',8781),Quiet);threading.Thread(target=server.serve_forever,daemon=True).start()
mock='''window.wakeTest={locks:[],requests:0,deny:false,hold:false,resolve:null,visibility:'visible'};
Object.defineProperty(document,'visibilityState',{get:()=>wakeTest.visibility});
Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async(type)=>{
 if(type!=='screen')throw Error('Incorrect lock type');wakeTest.requests++;
 if(wakeTest.deny)throw Error('Not allowed');
 if(wakeTest.hold)await new Promise(resolve=>wakeTest.resolve=resolve);
 const lock=new EventTarget();lock.released=false;lock.release=async()=>{lock.released=true;lock.dispatchEvent(new Event('release'))};wakeTest.locks.push(lock);return lock;
}}});'''
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page();page.add_init_script(mock);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8781')
 def check(name,expr):
  assert page.evaluate(expr),name
  results.append(name)
 page.evaluate("go('focus');launchImmersiveFocus()")
 check('No wake lock before timer starts','wakeTest.requests===0')
 page.locator('#overlayStartBtn').click();page.wait_for_timeout(80)
 check('Starting focus requests screen lock',"wakeTest.requests===1&&!wakeTest.locks[0].released&&document.getElementById('focusWakeStatus').textContent.includes('stays awake')")
 page.evaluate('updateFocusScreenAwake();renderAll()');check('Rerender/update does not duplicate held lock','wakeTest.requests===1')
 page.locator('#overlayStartBtn').click();page.wait_for_timeout(30)
 check('Pausing releases lock','wakeTest.locks[0].released&&!timerHandle')
 page.locator('#overlayStartBtn').click();page.wait_for_timeout(30)
 check('Resume reacquires a lock','wakeTest.requests===2&&!wakeTest.locks[1].released')
 page.evaluate("wakeTest.visibility='hidden';document.dispatchEvent(new Event('visibilitychange'))");page.wait_for_timeout(30)
 check('Background releases lock but preserves timer','wakeTest.locks[1].released&&!!timerHandle')
 page.evaluate("wakeTest.visibility='visible';document.dispatchEvent(new Event('visibilitychange'))");page.wait_for_timeout(30)
 check('Returning to focus reacquires lock','wakeTest.requests===3&&!wakeTest.locks[2].released')
 page.evaluate('wakeTest.locks[2].release()');page.wait_for_timeout(30)
 check('System release shows retry without a request loop',"wakeTest.requests===3&&!document.getElementById('focusWakeRetry').hidden")
 page.locator('#focusWakeRetry').click();page.wait_for_timeout(30);check('Retry reacquires lock','wakeTest.requests===4')
 page.evaluate('exitImmersiveFocus()');page.wait_for_timeout(30)
 check('Exiting focus releases lock while existing timer continues','wakeTest.locks[3].released&&!!timerHandle')
 page.evaluate('launchImmersiveFocus()');page.wait_for_timeout(30);check('Reopening a running timer reacquires lock','wakeTest.requests===5')
 page.evaluate('setFocusLength(50)');page.wait_for_timeout(30);check('Changing duration releases lock and resets timer','wakeTest.locks[4].released&&seconds===3000&&!timerHandle')
 page.locator('#overlayStartBtn').click();page.wait_for_timeout(30);page.evaluate('seconds=1');page.wait_for_timeout(1100)
 check('Session completion releases lock','wakeTest.locks[5].released&&!timerHandle')
 page.evaluate('toggleImmersiveTimer()');page.wait_for_timeout(30);page.evaluate('finishImmersiveTask()');page.wait_for_timeout(30)
 check('Task completion releases lock','wakeTest.locks[6].released&&!timerHandle')
 page.evaluate("go('focus');launchImmersiveFocus();wakeTest.deny=true;toggleImmersiveTimer()");page.wait_for_timeout(30)
 check('Denied lock keeps timer functional and offers retry',"!!timerHandle&&!document.getElementById('focusWakeRetry').hidden&&document.getElementById('focusWakeStatus').textContent.includes('may sleep')")
 page.evaluate('resetTimer(25);wakeTest.deny=false;wakeTest.hold=true;toggleImmersiveTimer()');page.wait_for_timeout(30);page.evaluate('toggleImmersiveTimer();wakeTest.resolve()');page.wait_for_timeout(50)
 check('Late acquired lock after pause is immediately released','wakeTest.locks.at(-1).released&&!timerHandle')
 page.evaluate('wakeTest.hold=false;toggleImmersiveTimer()');page.wait_for_timeout(30)
 page.evaluate("window.dispatchEvent(new Event('pagehide'))");page.wait_for_timeout(30)
 check('Page hide releases lock even before visibility changes','wakeTest.locks.at(-1).released&&!!timerHandle')
 page.evaluate("window.dispatchEvent(new Event('pageshow'))");page.wait_for_timeout(30)
 check('Page restore reacquires lock','!wakeTest.locks.at(-1).released')
 page.evaluate("resetTimer(25);Object.defineProperty(navigator,'wakeLock',{configurable:true,value:undefined});toggleImmersiveTimer()");page.wait_for_timeout(30)
 check('Unsupported browser gets fallback without breaking timer',"!!timerHandle&&document.getElementById('focusWakeStatus').textContent.includes('unavailable')")
 for width in [1440,390,320]:
  page.set_viewport_size({'width':width,'height':900});check(f'Focus layout fits {width}px',"document.getElementById('focusOverlay').scrollWidth<=innerWidth")
 check('No JavaScript errors',not errors and 'true' or 'false')
 browser.close()
server.shutdown();print(json.dumps(results,indent=2))
