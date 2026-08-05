// Deploy this as a standalone Google Apps Script project (script.google.com), not part
// of the Next.js app -- this repo has no way to run or host it. See SETUP.md for the
// full deployment walkthrough.
//
// Script Properties required (Project Settings > Script Properties):
//   UPLOAD_SECRET   - shared secret; must match GOOGLE_DRIVE_UPLOAD_SECRET in .env.local
//   DRIVE_FOLDER_ID - the Google Drive folder ID that uploaded ID proofs are saved into
//
// Uploaded files are shared as "Anyone with the link can view" -- the link itself is the
// access control, so treat any URL this returns as sensitive.
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();

    if (!body.secret || body.secret !== props.getProperty("UPLOAD_SECRET")) {
      return jsonResponse({ error: "unauthorized" });
    }
    if (!body.fileName || !body.mimeType || !body.base64Data) {
      return jsonResponse({ error: "missing fields" });
    }

    var folder = DriveApp.getFolderById(props.getProperty("DRIVE_FOLDER_ID"));
    var bytes = Utilities.base64Decode(body.base64Data);
    var blob = Utilities.newBlob(bytes, body.mimeType, body.fileName);
    var file = folder.createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return jsonResponse({ url: file.getUrl() });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
