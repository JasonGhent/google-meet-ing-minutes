/* brute force of some screen scraping to convert captions into transcript */

// Constants
const CAPTIONS_ON_SELECTOR = 'Turn on captions';
const CAPTIONS_OFF_SELECTOR = 'Turn off captions';

const SELECTOR = 'c-wiz [jsmodel] > div > [jscontroller]:nth-of-type(5)';
const SCRAPE_RATE = 500; // ms
let CHAT_LOG = {};

// Toggles
let YOU;

// helpers
const captionsOnBtn = el => el.textContent === CAPTIONS_ON_SELECTOR;
const captionsOffBtn = el => el.textContent === CAPTIONS_OFF_SELECTOR;
const links = el => el.src.includes('googleusercontent.com/');
const googImgs = el => [...el.querySelectorAll('img')].filter(links).length;

let TEST;
try {
  TEST = process.env.TEST; // eslint-disable-line
} catch (e) { } // eslint-disable-line
if (TEST !== 'true') {
  // run
  buildTranscript();
}

/* - METHODS - */
// main method
function buildTranscript() {
  try {
    forceEnableCaptions();

    // detect captions in DOM. if none, wait for next batch run
    const imgs = domHasCaptions();
    if (!imgs.length) { return; }

    createDownloadButton();

    // assumed to exist in DOM if messages are appearing on screen at this point
    getYouUser();

    // messages on screen at each invocation
    const captions = [...imgs[0].querySelectorAll('div:scope > div')];
    captions.forEach(buildHandleCaption());

    // weave user logs into unified ordered log output and show last 5
    console.log(JSON.stringify(orderByTime().slice(-5), null, 2));
  } catch(err) {
    console.log('ERR:', err);
  }

  setTimeout(buildTranscript, SCRAPE_RATE);
}

function buildHandleCaption(overrides, debug = false) {
  const log = (...args) => debug && console.log(...args);

  CHAT_LOG = (overrides && overrides.CHAT_LOG) || CHAT_LOG;

  return function handleCaption(el, index) {
    // get current caption data
    const created = new Date().getTime();
    const updated = new Date().getTime();
    const html = el.querySelector('div').innerHTML;
    const user_id = html.toLowerCase() === 'you' ? YOU : html;
    const newCaption = getMessage(el);
    const captionData = { created, updated, user_id, message: newCaption };

    // get previous message when not the first entry
    const orderedLog = orderByTime(true); // by 'created'
    const priorLogData = orderedLog[orderedLog.length - 1];

    // if new speaker, new caption data subs in for old caption data.
    // this invalidates some checks, but we'll do them anyway for simplicity.
    const newUserToLog = !priorLogData || priorLogData.user_id !== user_id;
    const oldCaptionData = newUserToLog ? captionData : priorLogData;
    const { message: oldCaption, created: prevCreated } = oldCaptionData || {};

    // string rewrite stitching. 'overlap' guaranteed to be lowercase.
    const oldLowCaption = oldCaption && oldCaption.toLowerCase();
    const newLowCaption = newCaption.toLowerCase();
    const overlap = findOverlap(oldLowCaption, newLowCaption);
    const start = oldCaption.slice(0, oldCaption.indexOf(overlap));
    const excess = newCaption.slice(overlap.length);

    // if no start/excess, but overlap, use new caption message entirely
    const onlyOverlap = !start && !excess && overlap && newCaption;
    const stitchedCaption = onlyOverlap || (start + overlap + excess);

    // lastEntry
    const chatLogLen = CHAT_LOG[user_id] && CHAT_LOG[user_id].length;
    const usersLastEntry = chatLogLen && CHAT_LOG[user_id][chatLogLen - 1];
    const { message, created: lastCreated, updated: up } = usersLastEntry || {};

    // conditionals
    const isFirstCaptionOnScreen = index === 0;
    const isNewSpeaker = !!newUserToLog;
    const isStale = newLowCaption === oldLowCaption;
    const isEmpty = newCaption.trim() === '';
    const isStaleOrEmpty = isStale || isEmpty;
    const isFirstCaptionForUser = !CHAT_LOG[captionData.user_id];
    const isHandled = isFirstCaptionForUser || isStaleOrEmpty || !oldLowCaption;
    const isRewrite = detectRewrites(oldLowCaption, newLowCaption, overlap);

    log('oldCaptionData', oldCaptionData);
    log('isFirstCaptionOnScreen:', isFirstCaptionOnScreen);
    log('isFirstCaptionForUser:', isFirstCaptionForUser);
    log('isStaleOrEmpty:', isStaleOrEmpty);
    log('isRewrite:', isRewrite);

    // no new data
    if (!isNewSpeaker && captionData === oldCaptionData) { return; }

    // does it match previous message for user in any way?
    //   do we create a new entry, or append to existing?
    if (isFirstCaptionOnScreen && !isFirstCaptionForUser) {
      if (!newCaption.includes(message)) { return; }

      // wholesale update (ignores truncations or resets)
      captionData.created = lastCreated;

      // only updated if message has changed
      if (message === newCaption) { captionData.updated = up; }

      CHAT_LOG[user_id][chatLogLen - 1] = captionData;
      return;
    }

    // if new message after fade away, just make new entry.. don't append old
    if (isNewSpeaker || isFirstCaptionOnScreen || isHandled) {
      isFirstCaptionForUser && (CHAT_LOG[user_id] = []);

      if (isNewSpeaker) {
        log('new speaker:', captionData.user_id);
        CHAT_LOG[user_id].push(captionData);
        return;
      }

      if (isFirstCaptionOnScreen) {
        log('adding message after fade');
        CHAT_LOG[user_id].push(captionData);
        return;
      }

      // if no overlap, append and return
      if (!oldLowCaption) {
        log('appending. no overlap or no prior message', captionData);
        CHAT_LOG[user_id].push(captionData);
        return;
      }
    }

    // on detection: replace prevMsg with updated last
    // rewrite only NEW tail msg pieces. rewriting start breaks overflows.
    if (isRewrite) {
      log('rewrite!', stitchedCaption); // TODO: keep an eye on this
      captionData.message = stitchedCaption;
      captionData.created = prevCreated;
      CHAT_LOG[user_id][CHAT_LOG[user_id].length - 1] = captionData;
      return;
    }
  };
}

function orderByTime(byCreated) {
  const flat = [];
  for (var user in CHAT_LOG) {
    flat.push(CHAT_LOG[user]);
  }
  const arr = flat.flat();
  const field = byCreated ? 'created' : 'updated';
  return arr.sort((a, b) => a[field] - b[field]);
}

function getMessage(el) {
  const cumulative = [];
  const extractChat = ({ innerHTML: message }) => cumulative.push(message);
  [...el.querySelectorAll('span > span')].forEach(extractChat);
  const message = cumulative.join(' ');
  return message;
}

function findOverlap(a, b) {
  if (b.length === 0) { return ''; }
  if (a.endsWith(b)) { return b; }
  if (a.indexOf(b) >= 0) { return b; }
  return findOverlap(a, b.substring(0, b.length - 1));
}

function detectHomonyms(prev, last) {
  // format for easier comparisons
  const format = t => t.replace(/[^0-9a-z]/gi, '');
  const prevPhraseWords = prev.split(' ').map(format).filter(t=>t.length);
  const lastPhraseWords = last.split(' ').map(format).filter(t=>t.length);

  // todo? rewrite strategy.. in doubt, go with newer entry.
  const condition1 = prevPhraseWords.length <= lastPhraseWords.length;
  const condition2 = prevPhraseWords.length > lastPhraseWords.length;
  const smallPhrase = condition1 ? prevPhraseWords : lastPhraseWords;
  const largePhrase = condition2 ? prevPhraseWords : lastPhraseWords;
  const commonWords = largePhrase.filter(w => smallPhrase.includes(w));
  const allowedVariance = 0.5; // 50%
  const maxWordDiff = Math.floor(largePhrase.length * allowedVariance);
  const homoRewrite = commonWords.length >= (largePhrase.length - maxWordDiff);
  return homoRewrite;
}

function detectPartialRewrite(prev, last) {
  // format without specials (volatiles.. punctuation, etc)
  const prevNoSpecial = prev.replace(/[^0-9a-z]/gi, '');
  const lastNoSpecial = last.split('.')[0].replace(/[^0-9a-z]/gi, '');
  const partialRewrite = lastNoSpecial.indexOf(prevNoSpecial) === 0;
  return partialRewrite;
}

// FIXME: better detections?
// TODO:  detect when rewrite is inconsistent (to <=> two <=> too <=> 2)?
function detectRewrites(prev, last, overlap) {
  // - majority of new words in previous msg? a rewrite? (homonyms?)
  const homoRewrite = detectHomonyms(prev, last);

  // - last message zero-index contains previous message in full
  const fullRewrite = last.indexOf(prev) === 0;

  // - previous message contains first sentence of last message
  //  ^(i.e. rewrite of only most recent utterances)
  const partialRewrite = detectPartialRewrite(prev, last);

  // - previous caption in newest captioning.
  const overflowRewrite = overlap.length > 1 && prev.indexOf(overlap) >= 0;

  return homoRewrite || fullRewrite || partialRewrite || overflowRewrite;
}

/* istanbul ignore next */
function domHasCaptions() {
  // check for caption output in DOM
  const imgs = [...document.querySelectorAll(SELECTOR)].filter(googImgs);
  if (!imgs.length) {
    console.log('no chat on screen presently');
    setTimeout(buildTranscript, SCRAPE_RATE);
    return false;
  }
  return imgs;
}

/* istanbul ignore next */
// Auto enable captions
function forceEnableCaptions() {
  const allDivs = [...document.querySelectorAll('div')];

  const captionsOffDiv = allDivs.find(captionsOffBtn);
  if (captionsOffDiv) { return; }

  // click captions on
  const captionsOnDiv = allDivs.find(captionsOnBtn);
  captionsOnDiv && captionsOnDiv.click();
}

// terrible way of getting this.. black magic. :(
function getYouUser() {
  const ds7 = el => el.textContent.includes('AF_initDataCallback({key: \'ds:7');
  const text = [...document.querySelectorAll('script')].find(ds7).innerText;
  const json = text.slice(text.indexOf('['), text.indexOf(']')+1);
  YOU = JSON.parse(json)[6];
}

function createDownloadButton() {
  // remove old button until moved out of recursive caller
  const stale = document.getElementById('transcript');
  stale && stale.remove();

  // create button
  var div = document.createElement('div');
  div.id = 'transcript';

  // style button
  div.style.zIndex = '9';
  div.style.position = 'absolute';
  div.style.top = '50%';
  div.style.left = '0';
  div.style.width = '100px';
  div.style.height = '100px';
  div.style.background = 'teal';
  div.style.color = 'black';
  div.style.textAlign = 'center';
  div.innerHTML = 'click me to download transcript';

  // setup click handler for downloading
  div.onclick = () => {
    var a = window.document.createElement('a');
    const log = orderByTime();
    const map = e => `"${e.created}","${e.updated}","${e.user_id}","${e.message}"`;
    const csv = log.map(map);
    const type = {type: 'text/csv'};
    a.href = window.URL.createObjectURL(new Blob([csv.join('\n')], type));
    a.download = 'transcript.csv';

    // Append anchor to body.
    document.body.appendChild(a);
    a.click();

    // Remove anchor from body
    document.body.removeChild(a);
  };

  // append to body
  document.body.appendChild(div);
}

if (TEST) {
  module.exports = { buildHandleCaption };
}
