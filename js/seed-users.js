// Bootstrap account, and nothing more.
//
// This file is served to anyone who opens the app, so every account in it is
// public knowledge. It used to seed five accounts with printed starter
// passwords; four of those were never changed and stayed usable on the live
// site. Real accounts belong in Supabase, where this device pulls them and
// they override anything here.
//
// What is left is one admin with a long random password, kept only so the
// owner can still get in on a device that has never reached the cloud. The
// password lives in CREDENTIALS.txt on the owner's machine, never in git.
const SEED_USERS = [
  {
    "id": "u_seed_admin",
    "username": "admin",
    "name": "Rakesh Makani (Owner)",
    "role": "admin",
    "pass": "s1$5000$169a2415cfc2e49f$541046612ec70f708914c7df6fc518a367c1204d495c147006362c0f1fc9b6d7",
    "active": true,
    "must_change": false
  }
];
