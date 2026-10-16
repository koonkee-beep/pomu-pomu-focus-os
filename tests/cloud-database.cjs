// Run: NODE_PATH=<directory containing @electric-sql/pglite> node tests/cloud-database.cjs
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs'), assert = require('node:assert/strict');
(async () => {
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
 await db.exec(fs.readFileSync('supabase/setup.sql', 'utf8'));
 const state = { tasks: [], inbox: [], parking: [], focusMinutes: {}, categories: [], anchor: '' };
 async function actor(id) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec('set role authenticated'); }
 async function write(revision, payload=state) { return (await db.query('select public.pomu_write_snapshot($1,$2::jsonb) as revision',[revision,JSON.stringify(payload)])).rows[0].revision; }
 await actor('11111111-1111-4111-8111-111111111111');
 assert.equal(Number(await write(0)),1); assert.equal(Number(await write(1,{...state,anchor:'A'})),2);
 assert.equal(await write(1,{...state,anchor:'stale overwrite'}),null);
 assert.equal((await db.query('select payload from public.pomu_snapshots')).rows[0].payload.anchor,'A');
 await assert.rejects(db.query("update public.pomu_snapshots set revision=1"),/permission denied/);
 await actor('22222222-2222-4222-8222-222222222222');
 assert.equal((await db.query('select * from public.pomu_snapshots')).rows.length,0);
 assert.equal(Number(await write(0,{...state,anchor:'B'})),1);
 assert.equal((await db.query('select * from public.pomu_snapshots')).rows.length,1);
 assert.equal((await db.query("select * from public.pomu_snapshots where user_id='11111111-1111-4111-8111-111111111111'")).rows.length,0);
 await assert.rejects(db.query('delete from public.pomu_snapshots'),/permission denied/);
 await assert.rejects(write(1,{tasks:[]}),/Invalid/);
 await assert.rejects(write(-1),/Invalid/);
 await assert.rejects(write(1,{...state,anchor:'x'.repeat(2100000)}),/oversized/);
 await actor(''); await assert.rejects(write(0),/Sign in required/);
 await db.exec('reset role; set role anon');
 await assert.rejects(db.query('select * from public.pomu_snapshots'),/permission denied/);
 await assert.rejects(write(0),/permission denied/);
 await actor('11111111-1111-4111-8111-111111111111');
 assert.equal((await db.query('select payload from public.pomu_snapshots')).rows[0].payload.anchor,'A');
 await db.close();
 console.log('PASS: real PostgreSQL RLS separates two users; anon/direct writes denied; version conflicts preserve data; malformed/oversized writes rejected.');
})().catch(error=>{console.error(error);process.exitCode=1});
