// Deploy this as a standalone Google Apps Script project (script.google.com), not part
// of the Next.js app -- this repo has no way to run or host it. See SETUP.md for the
// full deployment walkthrough.
//
// Script Properties (Project Settings > Script Properties):
//   DRIVE_FOLDER_ID - optional. The folder uploaded ID proofs are saved into. Left unset,
//                     the first upload creates "bakeryv" in the script account's My Drive
//                     and records its id here, so later runs are a direct lookup. Set it
//                     by hand only to point at a folder you already have.
//
// There is no shared secret on this endpoint: deployed with "Anyone" access, anyone who
// learns the /exec URL can write files into that folder, so treat the URL as a credential
// and re-deploy to a new URL if it leaks.
//
// Uploaded files are shared as "Anyone with the link can view" -- the link itself is the
// access control, so treat any URL this returns as sensitive. When that sharing call is
// denied (see below) the file stays restricted to whoever can already reach the folder,
// which is more private, not less -- the response flags it so the app can say so.
var FOLDER_NAME = "bakeryv";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (!body.fileName || !body.mimeType || !body.base64Data) {
      return jsonResponse({ error: "missing fields" });
    }

    var folder = getIdProofFolder();
    var bytes = Utilities.base64Decode(body.base64Data);
    var blob = Utilities.newBlob(bytes, body.mimeType, body.fileName);
    var file = folder.createFile(blob);

    // Deliberately isolated from the outer try/catch: createFile has already succeeded by
    // this point, so letting a setSharing failure fall through would return {error} and
    // throw away the URL of a file that is sitting in Drive -- an orphan nothing links to.
    // "Access denied: DriveApp." here does NOT mean the upload failed; it usually means
    // link-sharing can't be changed on this folder (a Shared Drive, a folder owned by
    // someone else, or a Workspace policy blocking "Anyone with the link").
    var shared = true;
    var shareError = null;
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      shared = false;
      shareError = String(shareErr);
    }

    return jsonResponse({ url: file.getUrl(), shared: shared, shareError: shareError });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

// Resolves the upload folder, creating "bakeryv" on the very first upload. Creating it
// here rather than expecting a hand-made folder also sidesteps the usual cause of
// "Access denied: DriveApp." on setSharing: a folder the script creates lives in the
// script account's own My Drive and is owned by it, so it may change link sharing --
// unlike a Shared Drive folder or one owned by somebody else.
function getIdProofFolder() {
  var props = PropertiesService.getScriptProperties();
  var recorded = folderFromId(props.getProperty("DRIVE_FOLDER_ID"));
  if (recorded) return recorded;

  // Serialised so two first-time uploads arriving together can't each create their own
  // "bakeryv", which would silently split ID proofs across two folders.
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Re-check inside the lock: another request may have created it while we waited.
    recorded = folderFromId(props.getProperty("DRIVE_FOLDER_ID"));
    if (recorded) return recorded;

    var folder = findFolderByName(FOLDER_NAME) || DriveApp.createFolder(FOLDER_NAME);
    props.setProperty("DRIVE_FOLDER_ID", folder.getId());
    return folder;
  } finally {
    lock.releaseLock();
  }
}

// Null rather than throwing when the id is unset, unreadable, or points at a folder that
// has since been trashed -- callers re-establish the folder instead of failing every
// upload from then on. getFolderById succeeds on trashed folders, hence the explicit check.
function folderFromId(id) {
  if (!id) return null;
  try {
    var folder = DriveApp.getFolderById(id);
    return folder.isTrashed() ? null : folder;
  } catch (err) {
    return null;
  }
}

// Adopt an existing "bakeryv" instead of creating a second one -- covers a re-deploy that
// starts with empty Script Properties while the folder from a previous deployment is
// still there, holding the ID proofs already uploaded into it.
function findFolderByName(name) {
  var folders = DriveApp.getFoldersByName(name);
  while (folders.hasNext()) {
    var folder = folders.next();
    if (!folder.isTrashed()) return folder;
  }
  return null;
}

// Run this manually from the Apps Script editor (Run > diagnoseFolder) and read the
// Execution log to work out why setSharing is denied. Deliberately NOT exposed via
// doGet: the web app is deployed with "Anyone" access, so a doGet would leak folder
// details to anyone holding the /exec URL.
function diagnoseFolder() {
  var folder = getIdProofFolder();
  var owner = folder.getOwner();

  Logger.log("Folder:      %s", folder.getName());
  Logger.log("Folder id:   %s", folder.getId());
  Logger.log("Effective:   %s", Session.getEffectiveUser().getEmail());
  // A Shared Drive folder reports no owner -- and Shared Drive items reject
  // setSharing(ANYONE_WITH_LINK), which is the most common cause of this error.
  Logger.log("Owner:       %s", owner ? owner.getEmail() : "(none -- likely a Shared Drive)");
  Logger.log("Access:      %s", folder.getSharingAccess());
  Logger.log("Permission:  %s", folder.getSharingPermission());
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
