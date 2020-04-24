Google Meet Auto-Captions to Meeting Minutes Transcriber
--

Puts a button on screen to download captions as a CSV transcript. Captions are
read from automatic captioning output. Caption stitching logic is wonky, but
should give a decent gist. Better than nothing; not better than a stenographer.

#### HOW

Copy the contents of build/bookmarklet into the URL of a new browser bookmark.
Click the bookmark when in a Meet you would like to transcribe.

#### OR..

Copy the contents of build/bookmarklet to the URL bar of any open Meet window.
(Most browsers strip "javascript:" from what you paste in. You WILL have to retype that part after pasting.)

#### What to expect

Once someone speaks, you will see an ugly button to download the transcript of the call FROM WHEN YOU HIT ENTER AFTER PASTING up to that point in time THAT YOU CLICK THE BUTTON.

The logic for caption stitching is clearly broken. **PRs are welcome.**

#### Related

https://support.google.com/hangouts/thread/11396560?hl=en
