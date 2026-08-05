-- Google Drive shareable link for the employee's uploaded ID proof PDF (uploaded via a
-- Google Apps Script web app -- see google-apps-script/upload-id-proof.gs). Nullable:
-- upload is optional, and existing employees won't have one until backfilled.
alter table employees add column id_proof_url text;
