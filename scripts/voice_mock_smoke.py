"""Explicitly MOCKED WebRTC browser tests. No real microphone/provider is contacted."""
import json
from playwright.sync_api import sync_playwright, expect

BASE='http://127.0.0.1:5173'
MOCK_JS=r'''
window.__stopped=0;window.__closed=0;window.__sent=[];window.__delayPermission=false;
const makeStream=()=>({getTracks:()=>[{stop:()=>window.__stopped++}]});
Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
 if(window.__delayPermission)return await new Promise(resolve=>{window.__grant=()=>resolve(makeStream());});
 return makeStream();
}});
class FakePeer {
 constructor(){this.iceGatheringState='complete';this.connectionState='new';this.localDescription=null;}
 addTrack(){} addEventListener(){} removeEventListener(){}
 createDataChannel(){const channel={readyState:'connecting',send:s=>window.__sent.push(JSON.parse(s)),close:()=>{channel.readyState='closed';}};window.__dc=channel;return channel;}
 async createOffer(){return {type:'offer',sdp:'v=0\r\nmocked-browser-test-only'};}
 async setLocalDescription(offer){this.localDescription=offer;}
 async setRemoteDescription(){this.connectionState='connected';window.__dc.readyState='open';setTimeout(()=>window.__dc.onopen?.(),0);}
 close(){window.__closed++;this.connectionState='closed';}
}
window.RTCPeerConnection=FakePeer;
window.__emitTool=(id)=>{void window.__dc.onmessage({data:JSON.stringify({type:'response.function_call_arguments.done',name:'web_search',arguments:JSON.stringify({query:'public test query'}),call_id:id})});};
'''


def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':390,'height':844})
        page.set_default_timeout(8000)
        errors=[];calls=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script(MOCK_JS)
        health={'mode':'live','version':'mock-only','auth_required':True,
                'providers':[{'id':'openai','configured':True,'default_model':'mock-model'}],
                'features':{'search':True,'stt':False,'tts':False,'realtime':True,'header_checks':False,'local_tools':True},'workers':{'go':False,'rust':False}}
        page.route('**/api/health',lambda r:r.fulfill(json=health))
        page.route('**/api/voice/realtime',lambda r:r.fulfill(content_type='application/sdp',body='v=0\r\nmocked-answer-only'))
        def tool(route):
            calls.append(route.request.post_data_json)
            route.fulfill(json={'sources':[{'id':1,'title':'Mock test','url':'https://example.com','snippet':'Mock-only evidence'}],'untrusted':True})
        page.route('**/api/voice/tool',tool)
        page.goto(BASE,wait_until='networkidle')
        page.locator('.mobile-nav').get_by_role('button',name='Live voice',exact=True).click()
        page.get_by_role('button',name='Realtime voice',exact=False).click()
        page.get_by_role('button',name='Start conversation',exact=False).click()
        expect(page.locator('.voice-state')).to_have_text('Listening')
        page.evaluate("window.__emitTool('mock-1')")
        expect(page.locator('.approval-card')).to_be_visible()
        assert not calls
        page.get_by_role('button',name='Allow once',exact=True).click()
        page.wait_for_function("window.__sent.some(x=>x.item?.call_id==='mock-1')")
        assert len(calls)==1
        page.evaluate("window.__emitTool('mock-2')")
        expect(page.locator('.approval-card')).to_be_visible()
        page.get_by_role('button',name='Deny',exact=True).click()
        page.wait_for_function("window.__sent.some(x=>x.item?.call_id==='mock-2')")
        assert len(calls)==1
        denied=page.evaluate("window.__sent.find(x=>x.item?.call_id==='mock-2').item.output")
        assert 'did not approve' in denied
        page.get_by_role('button',name='End conversation',exact=False).click()
        expect(page.get_by_role('button',name='Start conversation',exact=False)).to_be_visible()
        assert page.evaluate('window.__stopped')>=1 and page.evaluate('window.__closed')>=1
        page.get_by_role('button',name='Start conversation',exact=False).click()
        expect(page.locator('.voice-state')).to_have_text('Listening')
        page.evaluate("window.dispatchEvent(new Event('shizz:background'))")
        expect(page.get_by_role('button',name='Start conversation',exact=False)).to_be_visible()
        assert page.evaluate('window.__stopped')>=2
        page.evaluate('window.__delayPermission=true')
        page.get_by_role('button',name='Start conversation',exact=False).click()
        page.wait_for_function('typeof window.__grant === "function"')
        page.get_by_role('button',name='End conversation',exact=False).click()
        page.evaluate('window.__grant()')
        expect(page.get_by_role('button',name='Start conversation',exact=False)).to_be_visible()
        page.wait_for_function('window.__stopped>=3')
        assert page.locator('audio').count()==0
        assert not errors,errors
        browser.close()
    print(json.dumps({'mocked_voice_checks':['Tool requires explicit approval before any request','Approved tool executes once','Denied tool does not execute','End call stops tracks and closes peer','Native background event stops capture','Late microphone permission after cancel is cleaned up','Audio elements removed; no uncaught errors'], 'count':7,'real_webrtc_or_microphone_tested':False,'paid_provider_tested':False},indent=2))

if __name__=='__main__':main()
