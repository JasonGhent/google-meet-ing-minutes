const { buildHandleCaption } = require('./transcribe');
const assert = require('assert');

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

function buildEl(user = 'TEST', text = 'TEXT', multSpan = false) {
  const buildSpan = str => `<span><span>${str}</span></span>`;
  const spans = multSpan
    ? text.split(' ').map(buildSpan).join('\n\t')
    : buildSpan(text);
  const el = `
    <img class="KpxDtd" src="https://lh6.googleusercontent.com/">
    <div class="zs7s8d">${user}</div>
    <div jsname="YSxPC" class="Mz6pEf" style="height: 140px;">
      <div jsname="tgaKEf" class="iTTPOb" style="text-indent: 99.6094px;">
        ${ spans }
      </div>
    </div>
  `;
  const dom = new JSDOM(el, { includeNodeLocations: true });
  const input = dom.window.document;
  return input;
}

describe('transcript builder', () => {
  it('first message after lapse or start', () => {
    const overrides = { CHAT_LOG: {}, NEW_BATCH_FLAG: true };

    const txt = 'two words';
    [buildEl(1, txt, true)].forEach(buildHandleCaption(overrides));

    assert.ok(overrides.CHAT_LOG["1"].length === 1);
  });

  it('single message from single user should work', () => {
    const overrides = { CHAT_LOG: {} };

    const txt = 'two words';
    [buildEl(1, txt, true)].forEach(buildHandleCaption(overrides));

    assert.ok(overrides.CHAT_LOG["1"][0].message.includes(txt));
  });

  describe('multiple captures, spaced apart', () => {
    const overrides = { CHAT_LOG: {} };

    it('first message', () => {
      const msg1 = buildEl('user1', 'message 1');
      const captions = [msg1];
      captions.forEach(buildHandleCaption(overrides));

      assert.ok(overrides.CHAT_LOG['user1'][0].message === 'message 1');
    });

    it('empty screen', () => {
      const captions = [];
      captions.forEach(buildHandleCaption(overrides));

      assert.ok(overrides.CHAT_LOG['user1'].length === 1)
    });

    it('second message', () => {
      const msg1 = buildEl('user1', 'message 1 (updated)');
      const captions = [msg1];
      captions.forEach(buildHandleCaption(overrides));

      assert.ok(overrides.CHAT_LOG['user1'].length === 1)
    });
  });

  /*
    should result in two messages.. one per user. first user has update at end
  */
  describe('multiple captures', () => {
    const overrides = { CHAT_LOG: {} };

    it('two messages from two users', () => {
      const msg1 = buildEl('user1', 'message 1');
      const msg2 = buildEl('user2', 'message 2');
      const captions = [msg1, msg2];
      captions.forEach(buildHandleCaption(overrides));

      assert.ok(overrides.CHAT_LOG['user1'][0].message === 'message 1');
    });

    it('updated message from first user while second user is talking', () => {
      const msg1 = buildEl('user1', 'message 1 (Updated)');
      const msg2 = buildEl('user2', 'Message 2');
      const captions = [msg1, msg2];
      captions.forEach(buildHandleCaption(overrides));

      assert.ok(overrides.CHAT_LOG['user1'].length === 1)
      assert.ok(overrides.CHAT_LOG['user2'].length === 1)
    });

    // scrapes:
    // --
    // u1: 'foo bar baz'
    // u2: 'qoo qar qaz'
    // ==>
    // u2: 'qoo qar qaz qax'
    // u1: 'bleep bleep'
    it('new speaker, partial overwrite of old speaker', () => {
      const msg1 = buildEl('user2', 'message 2 (Updated)');
      const msg2 = buildEl('user1', 'message 3');
      const captions = [msg1, msg2];
      captions.forEach(buildHandleCaption(overrides));

      assert.ok(overrides.CHAT_LOG['user1'].length === 2)
      assert.ok(overrides.CHAT_LOG['user2'].length === 1)
    });

    // scapes:
    // u2: 'qoo qar qaz qax'
    // u1: 'bleep bleep'
    // ==>
    // u1: 'bleep bleep'
    // u3: 'blap'
    // u4: 'blerch'
    it('two new users enter the fray', () => {
      const msg1 = buildEl('user1', 'message 3');
      const msg2 = buildEl('user3', 'message 2 (updated)'); // deliberate repeat
      const msg3 = buildEl('user4', 'blerch');
      const captions = [msg1, msg2, msg3];
      captions.forEach(buildHandleCaption(overrides));

      assert.ok(overrides.CHAT_LOG['user3'].length === 1)
      assert.ok(overrides.CHAT_LOG['user4'].length === 1)
    });

    it.skip('TODO: next test', () => {
      console.log('starts with:', overrides.CHAT_LOG);

      const msg1 = buildEl('user1', 'message 3');
      const msg2 = buildEl('user3', 'message 2 (updated)'); // deliberate repeat
      const msg3 = buildEl('user4', 'blerch');
      const captions = [msg1, msg2, msg3];
      captions.forEach(buildHandleCaption(overrides, true));

      console.log(JSON.stringify(overrides, null, 2));
    });
  });
})
