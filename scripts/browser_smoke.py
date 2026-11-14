"""Browser smoke tests. Run against scripts/dev.sh; not a physical Android or live-provider test.
Optional dependency: pip install playwright && python -m playwright install chromium
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--base',default='http://127.0.0.1:5173')
    parser.add_argument('--screenshots',default='')
    args=parser.parse_args()
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':1440,'height':1000})
        errors=[];leaks=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda request:leaks.append(request.url) if 'leak.invalid' in request.url else None)
        page.goto(args.base,wait_until='networkidle')
        expect(page.locator('.connection')).to_have_text('Local demo')
        results.append('Demo identity and provider-unconfigured state')
        if args.screenshots:
            folder=Path(args.screenshots);folder.mkdir(parents=True,exist_ok=True)
            page.screenshot(path=str(folder/'desktop.png'),full_page=True)
        page.get_by_role('button',name='Make security simpler',exact=False).click()
        expect(page.locator('.message.assistant .message-tools')).to_be_visible(timeout=12000)
        assert 'پاسکی' in page.locator('.message.assistant .markdown').inner_text()
        assert 'LOCAL DEMO' in page.locator('.message.assistant').inner_text()
        results.append('Sorani streamed demo reply is explicitly labelled')
        page.get_by_role('textbox',name='Message shizz ai agent').fill('![do not load](https://leak.invalid/pixel)')
        page.get_by_role('button',name='Send message',exact=True).click()
        expect(page.locator('.message.assistant .message-tools').last).to_be_visible(timeout=12000)
        assert not page.locator('.markdown img').count() and not leaks
        results.append('Markdown remote images never load')
        page.locator('.sidebar').get_by_role('button',name='Security lab',exact=True).click()
        page.get_by_role('button',name='Use a harmless example',exact=False).click()
        page.get_by_role('button',name='Run check',exact=True).click()
        expect(page.get_by_text('Private key material',exact=True)).to_be_visible()
        assert 'critical' in page.locator('.report').inner_text()
        assert 'EXAMPLE ONLY' not in page.locator('.report').inner_text()
        results.append('Real backend-local secret scan and redacted report')
        page.locator('.sidebar').get_by_role('button',name='Income studio',exact=True).click()
        page.get_by_role('button',name='Create proposal',exact=True).click()
        expect(page.locator('.proposal')).to_be_visible()
        assert '200.00' in page.locator('.proposal').inner_text()
        with page.expect_download() as download:
            page.get_by_role('button',name='Export draft',exact=True).click()
        assert download.value.suggested_filename=='shizz-proposal.md'
        results.append('Decimal quote, unsent proposal and browser export')
        page.locator('.sidebar').get_by_role('button',name='Models & settings',exact=True).click()
        token='test-device-token-never-persist-in-local-storage'
        page.get_by_label('Device access token',exact=False).fill(token)
        page.get_by_role('button',name='Save & connect',exact=True).click()
        stored=page.evaluate('JSON.stringify(localStorage)')
        assert token not in stored
        assert 'shizz.preferences' in stored
        results.append('Device token not persisted to localStorage')
        page.locator('.sidebar').get_by_role('button',name='Research',exact=True).click()
        page.get_by_role('textbox',name='Search query',exact=True).fill('Sorani cybersecurity')
        page.get_by_role('button',name='Search',exact=True).last.click()
        expect(page.locator('.toast')).to_contain_text('Local demo',timeout=8000)
        assert page.locator('.result-card').count()==0
        results.append('Demo search is disabled without fabricated sources')
        for width in [320,360,390,768,1440]:
            page.set_viewport_size({'width':width,'height':900})
            bar='.mobile-nav' if width<=800 else '.sidebar'
            for label in ['Assistant','Live voice','Research','Security lab','Income studio','Models & settings']:
                page.locator(bar).get_by_role('button',name=label,exact=True).click()
                assert not page.evaluate('document.documentElement.scrollWidth > window.innerWidth'),f'Overflow {width} {label}'
        results.append('No horizontal overflow on all six screens at 320/360/390/768/1440 px')
        page.set_viewport_size({'width':390,'height':844})
        page.locator('.mobile-nav').get_by_role('button',name='Live voice',exact=True).click()
        page.get_by_role('button',name='Configure voice',exact=False).click()
        expect(page.get_by_role('heading',name='Make it yours.',exact=True)).to_be_visible()
        results.append('Missing voice services route to setup, not fake microphone activity')
        page.locator('.mobile-nav').get_by_role('button',name='Assistant',exact=True).click()
        page.get_by_role('button',name='کوردی',exact=True).click()
        assert 'گفتوگۆ' in page.locator('.breadcrumb').inner_text()
        results.append('Sorani navigation toggle')
        if args.screenshots:
            fresh=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
            fresh.goto(args.base,wait_until='networkidle')
            fresh.screenshot(path=str(folder/'android-chat.png'),full_page=True)
            fresh.locator('.mobile-nav').get_by_role('button',name='Live voice',exact=True).click()
            fresh.screenshot(path=str(folder/'android-voice.png'),full_page=True)
            fresh.close()
        assert not errors,errors
        results.append('No uncaught browser page errors')
        browser.close()
    print(json.dumps({'browser_checks':results,'count':len(results),'live_paid_apis_tested':False,'physical_android_tested':False},indent=2))

if __name__=='__main__':
    main()
