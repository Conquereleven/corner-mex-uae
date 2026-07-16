# Admin Visibility

Founder/admin sees imported drafts and every review record with classification, source row/ID, safe supplier reference, media/category/price state, fingerprint and blocking reasons. Public/non-admin access is denied by RLS; existing product reads require `status = 'active'`, so drafts remain hidden.
