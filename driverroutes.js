import edge from "selenium-webdriver/edge.js";
import firefox from "selenium-webdriver/firefox.js";
import { Builder, Key,By } from "selenium-webdriver"; 
import htmlparser from "node-html-parser";
import {
  WEBDRIVERMODE,
  JBWAITING,
  RESULTWAITING,
  COOKIE,
  BROWSER,
} from "./config.js";
let charname = "";
// configure browser options ...
console.log(COOKIE);
console.log(WEBDRIVERMODE);
var driver;

if(WEBDRIVERMODE == true){

if (BROWSER === "firefox") driver = new Builder().forBrowser("firefox").build();
else if (BROWSER === 'chrome') driver = new Builder().forBrowser("chrome").build();
else {
  var service = new edge.ServiceBuilder().setPort(55555).build();
  var options = new edge.Options();
  driver = edge.Driver.createSession(options, service);
}

  await driver.get("https://poe.com");
await driver.manage().addCookie({ name: "p-b", value: COOKIE });
await driver.get("https://poe.com/chatgpt");
}

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
  console.log("searching for charname");
  
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
      newprompt += "\n";
    }
    if (messages[i].role === "user") {
      newprompt += "DATA_2: ";
      newprompt += messages[i].content;
      newprompt += "\n";
    }
  }
  
  console.log('message dump done')
  let contentsplit = systemmsgs.split('\n');
  
	let bigMessage = contentsplit.join('\n');
	let characterName = bigMessage.match(/Character: "([^"]*)"/)[1];
	let userName = bigMessage.match(/User: "([^"]*)"/)[1];
	bigMessage = bigMessage.replace(/\[Start a new chat\]/g, "");
	console.log("Character Name:", characterName);
	console.log("User Name:", userName);
	await driver.executeScript("arguments[0].value = arguments[1]", textfield, bigMessage);
	await textfield.sendKeys(`If you accept the requirements, please confirm by responding with "Understood." and nothing more. Once I receive your precise confirmation message, I will specify the context of the scene, as well as the characteristics, background, and personality of your character in the following message.`);
	await textfield.sendKeys(Key.ENTER)
	console.log('send system message done');
	await driver.sleep(500);
let splitedprompt = newprompt.split("\n");
  bigMessage = "[CHAT]\n" + splitedprompt.join('\n');
  bigMessage = bigMessage.replace(/DATA_1/g, characterName);
  bigMessage = bigMessage.replace(/DATA_2/g, userName);
  await driver.executeScript("arguments[0].value = arguments[1]", textfield, bigMessage);

  let understoodDetected = false;
  while (!understoodDetected) {
    try {
      await driver.sleep(500);
      let src = await driver.getPageSource();
      let root = htmlparser.parse(src);
      let chatBreakButton = root.querySelector(".ChatMessageInputFooter_chatBreakButton__hqJ3v");
      let markdownContainer = root.querySelector(".Markdown_markdownContainer__UyYrv");
      if (chatBreakButton && chatBreakButton.rawText.includes("Understood.") ||
          markdownContainer && markdownContainer.rawText.includes("Understood.")) {
        understoodDetected = true;
      }
    } catch (err) {
      console.log(err.message);
    }
  }
  
let buttonIsDisabled = true;
while (buttonIsDisabled) {
  try {
    let button = await driver.findElement(By.css('.Button_buttonBase__0QP_m.Button_primary__pIDjn.ChatMessageSendButton_sendButton__OMyK1.ChatMessageInputContainer_sendButton__s7XkP'));
    buttonIsDisabled = await button.isEnabled() === false;
    if (buttonIsDisabled) {
      console.log('Button is disabled');
      await driver.sleep(100);
    } else {
      console.log('Button is enabled');
      await new Promise(resolve => setTimeout(resolve, 1000));
	  
      const startTime = Date.now();
      while (Date.now() - startTime < 1000) {
        await textfield.sendKeys(Key.ENTER);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      console.log("Sending content");
    }
  } catch (error) {
    console.error(error);
  }
  if (buttonIsDisabled) {
  }
}

let buttonExists = false;
let shouldWait = true;

const waitThreeSeconds = () => new Promise(resolve => setTimeout(resolve, 4000));
const startTime = Date.now();

while (!buttonExists && shouldWait) {
  try {
    await driver.findElement(By.css('.Button_buttonBase__0QP_m.Button_tertiary__yq3dG.ChatStopMessageButton_stopButton__LWNj6'));
    buttonExists = true;
    shouldWait = false;
    console.log('Button exists');
  } catch (error) {
    console.log('Button does not exist yet');
    if (shouldWait) {
      await driver.sleep(500);
    }
  }

  const currentTime = Date.now();
  if (currentTime - startTime >= 3000) {
    shouldWait = false;
    console.log('Timeout: 3 seconds elapsed');
  }
}

return newprompt;
}

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

    console.log('Proceeding to the next steps.');
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