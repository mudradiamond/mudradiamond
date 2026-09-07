// Auto-generated seed users. Passwords are salted+iterated SHA-256 hashes (never plaintext).
// Admin can add/edit/remove users from the app (User Master).
// Every seeded account has must_change = true: the printed password works
// exactly once, then the user must set their own. This matters because a
// static site serves this file to anyone who has the link.
const SEED_USERS = [
  {
    "id": "u_seed_admin",
    "username": "admin",
    "name": "Rakesh Makani (Owner)",
    "role": "admin",
    "pass": "s1$5000$202e1be83a4dc2f3$fc6c05861947c971d95033561a4f90278bdca782f15ec45cae70442b53a71da3",
    "active": true,
    "must_change": true
  },
  {
    "id": "u_seed_manager",
    "username": "manager",
    "name": "Manager",
    "role": "manager",
    "pass": "s1$5000$26a10986069e76f9$2dfc01cfd931c183cc4d659552f0def038237edcd4379a720ffd6b79d7711197",
    "active": true,
    "must_change": true
  },
  {
    "id": "u_seed_entry1",
    "username": "entry1",
    "name": "Data Entry 1",
    "role": "operator",
    "pass": "s1$5000$08d0b207d9d00527$ea2480f07fa928db757310915584b6afea38161e1645876ffedd9ca6981eb09a",
    "active": true,
    "must_change": true
  },
  {
    "id": "u_seed_entry2",
    "username": "entry2",
    "name": "Data Entry 2",
    "role": "operator",
    "pass": "s1$5000$ebffc1b7acd63da5$a7aa73190f404e8fca0191896d10af29bcdb8b2c998e81f880f9cf246d802ce2",
    "active": true,
    "must_change": true
  },
  {
    "id": "u_seed_viewer",
    "username": "viewer",
    "name": "View Only",
    "role": "viewer",
    "pass": "s1$5000$646e123277e755e5$8e047487ebb628de5f11a3a13608ba1d4593fbe02968046d36a6c9bf7a3baaac",
    "active": true,
    "must_change": true
  }
];
