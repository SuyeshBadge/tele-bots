Here's the **updated Telegram Bot Message Formatting Guide**, strictly following Telegram's official formatting rules and best practices. This version removes the example column from tables for better clarity.

---

# **Telegram Bot Message Formatting Guide**

## **1. Supported Formatting Options**
Telegram supports two primary formatting methods for bot messages:

✅ **Markdown V2** (Recommended for better control)  
✅ **HTML Formatting** (For advanced styling)  

---

## **2. Markdown V2 Formatting (Recommended)**
Markdown V2 allows text styling but requires escaping special characters.

| **Format**   | **Syntax**                  |
|-------------|------------------------------|
| **Bold**    | `*bold text*`                 |
| *Italic*    | `_italic text_`               |
| `Monospace` | `` `monospace text` ``        |
| Hyperlink   | `[Text](https://example.com)` |
| Escape `.`  | `\.`, `\!`, `\-`, etc.        |

🔹 **Special Characters That Must Be Escaped in Markdown V2:**  
`* _ [ ] ( ) ~ > # + - = | { } . !`

✔️ **Example Markdown V2 Message:**  
```
*Hello!* 👋  
Welcome to _AI Expense Tracker_.  
Click [here](https://example.com) for details.  
```

---

## **3. HTML Formatting**
Telegram also supports **HTML tags** for styling.

| **Format**   | **Syntax**                    |
|-------------|--------------------------------|
| **Bold**    | `<b>bold text</b>`             |
| *Italic*    | `<i>italic text</i>`           |
| `Monospace` | `<code>monospace text</code>`  |
| Hyperlink   | `<a href="URL">Text</a>`       |

✔️ **Example HTML Message:**  
```html
<b>Hello!</b> 👋  
Welcome to <i>AI Expense Tracker</i>.  
Click <a href="https://example.com">here</a> for details.  
```

---

## **4. Inline Buttons & Menus**
Telegram bots support **interactive buttons** below messages.

✔️ **Inline Keyboard Buttons Example:**  
```json
{
  "inline_keyboard": [
    [{"text": "View Summary 📊", "callback_data": "summary"}],
    [{"text": "Settings ⚙️", "callback_data": "settings"}]
  ]
}
```

---

## **5. Best Practices**
✅ **Use Markdown V2 for better control**  
✅ **Keep messages under 4096 characters**  
✅ **Escape special characters when using Markdown V2**  
✅ **Use inline buttons instead of long menus**  
✅ **Test messages before deployment**  

Would you like me to format your bot messages based on these best practices? 🚀