const phoneNumberId = '1286517461221916';
const accessToken = 'EAAUJMw4LUU8BSvT9q8cHQPvRG9ccEue4RHS6FFcm23plQJgDR7pZBr5Byzd1KJokxE7i35WOUR6ZBvIrkR3ZBvLKATkfZCcMJ7B530ZCokkmX6k7bcswQ470NiBF7ktmVZCjyKgUVKu665kQJDXrJx7rAZCWILclCPPJFKZAJnPigZCTTsdkOdAAko41d8u6g0Mm828pU0Y8cT35a9ErVXlNATy2QNIOIoc11oXBvm42mM81oZBKyIFKSZCS0vyGPgzZBagN7wWbx33N8EvxHIh0Fipw';
const toPhoneNumber = '919316527283';
const message = 'Hello from the new WhatsApp Integration!';

fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: toPhoneNumber,
    type: 'text',
    text: { body: message }
  })
}).then(r => r.json()).then(console.log).catch(console.error);
