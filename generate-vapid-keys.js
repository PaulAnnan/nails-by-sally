#!/usr/bin/env node
// generate-vapid-keys.js
// Run this to generate VAPID keys for push notifications

import webpush from 'web-push';

console.log('\n🔐 Generating VAPID Keys for Push Notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ VAPID Keys Generated Successfully!\n');
console.log('Add these to your .env file:\n');
console.log('━'.repeat(70));
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@nailsbysally.com`);
console.log('━'.repeat(70));
console.log('\n💡 Important: Keep the private key secret!\n');
