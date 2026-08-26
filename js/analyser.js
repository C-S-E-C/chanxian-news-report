import Client from 'https://g4f.dev/dist/js/client.js';
const client = new Client();
const result = await client.chat.completions.create({
      model: 'gpt-4.1',  // Or "gpt-4o", "deepseek-v3", etc.
      messages: [{ role: 'user', content: 'Explain quantum computing' }]
});
console.log(result.choices[0].message.content);