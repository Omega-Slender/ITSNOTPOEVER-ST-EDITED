import edge from "selenium-webdriver/edge.js";
import firefox from "selenium-webdriver/firefox.js";
import chrome from "selenium-webdriver/chrome.js";
import { Builder, By, Key } from "selenium-webdriver";
import htmlparser from "node-html-parser";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { WEBDRIVERMODE, COOKIE, BROWSER } from "./config.js";

let charname = "";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(COOKIE);
console.log(WEBDRIVERMODE);
var driver;

async function initializeDriver() {
  let driverPath = join(__dirname, "drivers");

  if (BROWSER === "firefox") {
    driver = new Builder()
      .forBrowser("firefox")
      .setFirefoxService(new firefox.ServiceBuilder(join(driverPath, "geckodriver.exe")))
      .build();
  } else if (BROWSER === "chrome") {
    driver = new Builder()
      .forBrowser("chrome")
      .setChromeService(new chrome.ServiceBuilder(join(driverPath, "chromedriver.exe")))
      .build();
  } else {
    var service = new edge.ServiceBuilder(join(driverPath, "msedgedriver.exe")).setPort(55555).build();
    var options = new edge.Options();
    driver = edge.Driver.createSession(options, service);
  }

  await driver.get("https://poe.com");
  await driver.manage().addCookie({ name: "p-b", value: COOKIE });
  await driver.get("https://poe.com/chatgpt");
}

initializeDriver();

async function test(req, res) {
    if(req.body.reverse_proxy) return res.send(true)
    let lastmsg = ''
    let src, newsrc = ''
    while(true){
      newsrc = await driver.getPageSource();
      if(src === newsrc){
        break
      }
      else
      src = newsrc
      driver.sleep(1000)
    }
    let root = htmlparser.parse(src);
    let out = root.querySelectorAll(".Markdown_markdownContainer__UyYrv");
    let lastbubble = out[out.length - 1].querySelectorAll('p')
    for(let k in lastbubble){
      lastmsg += lastbubble[k]
      lastmsg += '\n'
    }
    lastmsg = lastmsg.replaceAll("<em>", '*')
    lastmsg = lastmsg.replaceAll("</em>", '*')
    lastmsg = lastmsg.replaceAll("<p>", '')
    lastmsg = lastmsg.replaceAll("</p>", '')
    lastmsg = lastmsg.replaceAll('<a node="[object Object]" class="MarkdownLink_linkifiedLink__KxC9G">', '')
    lastmsg = lastmsg.replaceAll("</a>", '')

    console.log(lastmsg)
    res.send(lastmsg)
}

async function convertPOEtoOAI(messages) {
  console.log(`before split = ${messages}`);
  let messageout = messages;
  if (messages.includes(":")) messageout = messages.split(":").splice(1);
  console.log(`after split = ${messageout}`);
  let newresponse = {
    "id": "chatcmpl-7ep1aerr8frmSjQSfrNnv69uVY0xM",
    "object": "chat.completion",
    "created": Date.now(),
    "model": "gpt-3.5-turbo-0613",
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": charname ? `${charname}: ${messageout}` : `${messageout}`
        },
        "finish_reason": "stop"
      }
    ],
    "usage": {
      "prompt_tokens": 724,
      "completion_tokens": 75,
      "total_tokens": 799
    }
  }
  console.log(`messageout : ${messageout}`);
  console.log(`newres : ${newresponse}`);
  return newresponse;
}

async function convertOAIToPoe(messages) {
  console.log("oai to poe");
  let newprompt = "";
  let systemsplit = messages[0].content.split("'s");
  
  let textfield = await driver.findElement(
    By.xpath(
      `//*[@id="__next"]/div[1]/div/section/div[2]/div/div/footer/div/div/div[1]/textarea`
    )
  );
  
  for (let sentence in systemsplit) {
    if (systemsplit[sentence].includes("Write ")) {
      charname = systemsplit[sentence].substring(
        6,
        systemsplit[sentence].length
      );
      break;
    }
  }
  
  let systemmsgs = ''
  console.log(`charname = ${charname}`);
  let aftersystem = false;
  
  for (let i in messages) {
    console.log(messages[i])
    if (messages[i].role === "system") {
      if(aftersystem){
        newprompt += messages[i].content + "\n";
      } else {
        if(messages[i].name === 'example_user')
        systemmsgs += `Your example message : ${messages[i].content} \n`
        else if(messages[i].name === 'example_assistant')
        systemmsgs += `${charname}'s example message : ${messages[i].content} \n`
        else
        systemmsgs += `${messages[i].content}\n`
      }

    }
    if (messages[i].role === "assistant") {
      aftersystem = true
      newprompt += `DATA_1: `;
      newprompt += messages[i].content;
      newprompt += "\n\n";
    }
    if (messages[i].role === "user") {
      newprompt += "DATA_2: ";
      newprompt += messages[i].content;
      newprompt += "\n\n";
    }
  }
  
  console.log('The information was successfully extracted')
  let contentsplit = systemmsgs.split('\n');
	let bigMessage = contentsplit.join('\n');
	console.log("Searching User and Character names");
	let characterName = bigMessage.match(/Character: "([^"]*)"/)[1];
	let userName = bigMessage.match(/User: "([^"]*)"/)[1];
	bigMessage = bigMessage.replace(/\[Start a new chat\]/g, "");
	console.log("User Name:", userName);
	console.log("Character Name:", characterName);
	
	await driver.executeScript("arguments[0].value = arguments[1]", textfield, bigMessage);
	await textfield.sendKeys(`If you accept the requirements, please confirm by responding with "Understood." and nothing more. Once I receive your precise confirmation message, I will specify the context of the scene, as well as the characteristics, background, and personality of your character in the following message.`);
	await textfield.sendKeys(Key.ENTER)
	console.log('It was pasted in the text box "Main prompt"');
	await driver.sleep(200);
	let splitedprompt = newprompt.split("\n");
	bigMessage = "[CHAT]\n" + splitedprompt.join('\n');
	bigMessage = bigMessage.replace(/DATA_1/g, characterName);
	bigMessage = bigMessage.replace(/DATA_2/g, userName);
	let contentToUse = bigMessage;
	const MAX_MESSAGE_LENGTH = 4500;
	let splitIndex = MAX_MESSAGE_LENGTH;
	let isMessageTooLong = contentToUse.length > MAX_MESSAGE_LENGTH;
	
	while (contentToUse[splitIndex] !== '\n' && splitIndex > 0) {
    splitIndex--;
	}
	const firstPart = contentToUse.slice(0, splitIndex);
	const remainingPart = contentToUse.slice(splitIndex);
	const firstPartWithNewLine = firstPart + "\n";
	await driver.executeScript("arguments[0].value = arguments[1]", textfield, firstPartWithNewLine);
	if(isMessageTooLong) {
    await textfield.sendKeys("[Answer only with a \"Understood 2.\" to be able to give you your next instructions.]");
	}
	await driver.sleep(2000);

//Detect if "Submit button" is available and if "Understood." exists
let buttonIsDisabled = true;
while (buttonIsDisabled) {
  try {
    let button = await driver.findElement(By.css('.Button_buttonBase__0QP_m.Button_primary__pIDjn.ChatMessageSendButton_sendButton__OMyK1.ChatMessageInputContainer_sendButton__s7XkP'));
    buttonIsDisabled = await button.isEnabled() === false;
    if (buttonIsDisabled) {
      console.log('Submit button not available');
      await driver.sleep(500);
    } else {
      console.log('Submit button is now available');

      while (true) {
        let mensajeFinal = '';
        let contenidoWebNuevo = await driver.getPageSource();
        let raizHTMLNuevo = htmlparser.parse(contenidoWebNuevo);
        let elementosMarkdownNuevo = raizHTMLNuevo.querySelectorAll(".Markdown_markdownContainer__UyYrv");
        let ultimaBurbujaChatNuevo = elementosMarkdownNuevo[elementosMarkdownNuevo.length - 1].querySelectorAll('p');

        for (let elemento of ultimaBurbujaChatNuevo) {
          mensajeFinal += elemento.innerHTML;
          mensajeFinal += '\n';
        }
        mensajeFinal = mensajeFinal
          .replaceAll("<em>", '*')
          .replaceAll("</em>", '*')
          .replaceAll("<br>", '')
          .replaceAll("<p>", '')
          .replaceAll("</p>", '')
          .replaceAll('<a node="[object Object]" class="MarkdownLink_linkifiedLink__KxC9G">', '')
          .replaceAll("</a>", '')
          .replaceAll('<code node="[object Object]">', '')
          .replaceAll('</code>', '');

        if (mensajeFinal.includes("Understood.")) {
          console.log("Understood, detected");
          mensajeFinal = '';

          while (true) {
            await textfield.sendKeys(Key.ENTER);
            await new Promise(resolve => setTimeout(resolve, 500));
            contenidoWebNuevo = await driver.getPageSource();
            raizHTMLNuevo = htmlparser.parse(contenidoWebNuevo);
            elementosMarkdownNuevo = raizHTMLNuevo.querySelectorAll(".Markdown_markdownContainer__UyYrv");
            ultimaBurbujaChatNuevo = elementosMarkdownNuevo[elementosMarkdownNuevo.length - 1].querySelectorAll('p');

            for (let elemento of ultimaBurbujaChatNuevo) {
              mensajeFinal += elemento.innerHTML;
              mensajeFinal += '\n';
            }
            mensajeFinal = mensajeFinal
              .replaceAll("<em>", '*')
              .replaceAll("</em>", '*')
              .replaceAll("<br>", '')
              .replaceAll("<p>", '')
              .replaceAll("</p>", '')
              .replaceAll('<a node="[object Object]" class="MarkdownLink_linkifiedLink__KxC9G">', '')
              .replaceAll("</a>", '')
              .replaceAll('<code node="[object Object]">', '')
              .replaceAll('</code>', '');

            if (!mensajeFinal.includes("Understood.")) {
              break;
            }
          }
        } else {
          if (isMessageTooLong) {
            console.log("Sending [CHAT]");
            await driver.executeScript("arguments[0].value = arguments[1]", textfield, "[CHAT]\n" + remainingPart);
          }
          break;
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
}

//Detect if "Submit button 2" is available and if "Understood 2." exists
if (isMessageTooLong) {
  await driver.sleep(2000);
  let actionButtonInactive = true;
  while (actionButtonInactive) {
    try {
      let actionButton = await driver.findElement(By.css('.Button_buttonBase__0QP_m.Button_primary__pIDjn.ChatMessageSendButton_sendButton__OMyK1.ChatMessageInputContainer_sendButton__s7XkP'));
      actionButtonInactive = await actionButton.isEnabled() === false;
      if (actionButtonInactive) {
        console.log('Submit button not available 2');
        await driver.sleep(500);
      } else {
        console.log('Submit button is now available 2');

        while (true) {
          let finalMessage = '';
          let newWebContent = await driver.getPageSource();
          let newHTMLRoot = htmlparser.parse(newWebContent);
          let newMarkdownElements = newHTMLRoot.querySelectorAll(".Markdown_markdownContainer__UyYrv");
          let newChatBubbleLast = newMarkdownElements[newMarkdownElements.length - 1].querySelectorAll('p');

          for (let element of newChatBubbleLast) {
            finalMessage += element.innerHTML;
            finalMessage += '\n';
          }
          finalMessage = finalMessage
            .replaceAll("<em>", '*')
            .replaceAll("</em>", '*')
            .replaceAll("<br>", '')
            .replaceAll("<p>", '')
            .replaceAll("</p>", '')
            .replaceAll('<a node="[object Object]" class="MarkdownLink_linkifiedLink__KxC9G">', '')
            .replaceAll("</a>", '')
            .replaceAll('<code node="[object Object]">', '')
            .replaceAll('</code>', '');

          if (finalMessage.includes("Understood 2.")) {
            console.log("Understood 2, detected");
            finalMessage = '';

            while (true) {
              await textfield.sendKeys(Key.ENTER);
              await new Promise(resolve => setTimeout(resolve, 500));
              newWebContent = await driver.getPageSource();
              newHTMLRoot = htmlparser.parse(newWebContent);
              newMarkdownElements = newHTMLRoot.querySelectorAll(".Markdown_markdownContainer__UyYrv");
              newChatBubbleLast = newMarkdownElements[newMarkdownElements.length - 1].querySelectorAll('p');

              for (let element of newChatBubbleLast) {
                finalMessage += element.innerHTML;
                finalMessage += '\n';
              }
              finalMessage = finalMessage
                .replaceAll("<em>", '*')
                .replaceAll("</em>", '*')
                .replaceAll("<br>", '')
                .replaceAll("<p>", '')
                .replaceAll("</p>", '')
                .replaceAll('<a node="[object Object]" class="MarkdownLink_linkifiedLink__KxC9G">', '')
                .replaceAll("</a>", '')
                .replaceAll('<code node="[object Object]">', '')
                .replaceAll('</code>', '');

              if (!finalMessage.includes("Understood 2.")) {
                break;
              }
            }
          } else {
            console.log("Sending [CHAT] 2");
            break;
          }
        }
      }
    } catch (exception) {
      console.error(exception);
    }
  }
}

//Detect if "[CHAT]" or "..." exist
let mensajeFinalChat = '';
let contenidoWebActualChat, contenidoWebNuevoChat = '';

while (true) {
  contenidoWebActualChat = await driver.getPageSource();
  let raizHTMLChat = htmlparser.parse(contenidoWebActualChat);
  let elementosMarkdownChat = raizHTMLChat.querySelectorAll(".Markdown_markdownContainer__UyYrv");
  let ultimaBurbujaChatChat = elementosMarkdownChat[elementosMarkdownChat.length - 1].querySelectorAll('p');

  for (let elementoChat in ultimaBurbujaChatChat) {
    mensajeFinalChat += ultimaBurbujaChatChat[elementoChat].innerHTML;
    mensajeFinalChat += '\n';
  }
  mensajeFinalChat = mensajeFinalChat.replaceAll("<em>", '*')
    .replaceAll("</em>", '*')
    .replaceAll("<br>", '')
    .replaceAll("<p>", '')
    .replaceAll("</p>", '')
    .replaceAll('<a node="[object Object]" class="MarkdownLink_linkifiedLink__KxC9G">', '')
    .replaceAll("</a>", '')
    .replaceAll('<code node="[object Object]">', '')
    .replaceAll('</code>', '');

  if (mensajeFinalChat.includes("[CHAT]") || mensajeFinalChat.includes("...")) {
    console.log("Awaiting response");
	mensajeFinalChat = '';
  } else {
    console.log("Response was detected");
    break;
  }

  await new Promise(resolver => setTimeout(resolver, 500));
}

//Wait button
let buttonExists = false;
let startTime = Date.now();

while (!buttonExists) {
  if ((Date.now() - startTime) > 2500) {
    console.log('Time out after 2.5 seconds');
    break;
  }

  try {
    await driver.findElement(By.css('.Button_buttonBase__0QP_m.Button_tertiary__yq3dG.ChatStopMessageButton_stopButton__LWNj6'));
    buttonExists = true;
    console.log('Wait button exists');
  } catch (error) {
    console.log('Wait button does not exist');
	await driver.sleep(200);
  }
}
return newprompt;
}

//Export mensage
async function sagedriverCompletion(req, res) {
  let maxtoken = req.body.max_tokens;
  driver.findElement(By.className("ChatMessageInputFooter_chatBreakButton__hqJ3v")).click();
  await convertOAIToPoe(req.body.messages);

  let lastmsg = '';
  let src, newsrc = '';

  while (true) {
    try {
      await driver.findElement(By.className("Button_buttonBase__0QP_m Button_tertiary__yq3dG ChatStopMessageButton_stopButton__LWNj6"));
    } catch (error) {
      break;
    }
  }

  while (true) {
    src = await driver.getPageSource();
    let root = htmlparser.parse(src);
    let out = root.querySelectorAll(".Markdown_markdownContainer__UyYrv");
    let lastbubble = out[out.length - 1].querySelectorAll('p');

    for (let k in lastbubble) {
	  lastmsg += lastbubble[k].innerHTML;
      lastmsg += '\n';
    }

    lastmsg = lastmsg.replaceAll("<em>", '*')
      .replaceAll("</em>", '*')
      .replaceAll("<br>", '')
      .replaceAll("<p>", '')
      .replaceAll("</p>", '')
      .replaceAll('<a node="[object Object]" class="MarkdownLink_linkifiedLink__KxC9G">', '')
      .replaceAll("</a>", '')
      .replaceAll('<code node="[object Object]">', '')
      .replaceAll('</code>', '');

    console.log('Proceeding to the next steps');
    break;
  }

  let newres = await convertPOEtoOAI(lastmsg, maxtoken);
  if (typeof newres == 'object') {
    newres = JSON.parse(JSON.stringify(newres));
  }

  console.log('Final result:', newres);
  res.status(200).json(newres);
}

export { sagedriverCompletion, test };