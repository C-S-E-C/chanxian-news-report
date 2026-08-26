import { createClient } from 'https://g4f.dev/dist/js/providers.js';

const client = createClient('default');
const result = await client.chat.completions.create({
    model: 'auto',
    messages: [{ role: 'user', content: 'Hello!' }]
});
console.log(result.choices[0].message.content);