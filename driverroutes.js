// Import necessary libraries
import edge from "selenium-webdriver/edge.js";
import firefox from "selenium-webdriver/firefox.js";
import { Builder, Key, By } from "selenium-webdriver";
import htmlparser from "node-html-parser";

// Import configuration constants
import {
  WEBDRIVERMODE,
  JBWAITING,
  RESULTWAITING,
  COOKIE,
  BROWSER,
} from "./config.js";

// Initialize the character name variable
let charname = "";

// Output configuration constants for debugging
console.log(COOKIE);
console.log(WEBDRIVERMODE);

// Declare a driver variable
let driver;

// Check if the WebDriver mode is enabled
if (WEBDRIVERMODE == true) {
  // Create the WebDriver instance based on the selected browser
  if (BROWSER === "firefox") {
    driver = new Builder().forBrowser("firefox").build();
  } else if (BROWSER === "chrome") {
    driver = new Builder().forBrowser("chrome").build();
  } else {
    // For other browsers (in this case, edge), create the WebDriver using a custom service and options
    var service = new edge.ServiceBuilder().setPort(55555).build();
    var options = new edge.Options();
    driver = edge.Driver.createSession(options, service);
  }

  // Navigate to the target website and set the provided cookie
  await driver.get("https://poe.com");
  await driver.manage().addCookie({ name: "p-b", value: COOKIE });
  await driver.get("https://poe.com/chatgpt");
}

// Function to test the Selenium WebDriver
async function test(req, res) {
  // If reverse proxy is enabled, return true
  if (req.body.reverse_proxy) return res.send(true);

  // Initialize variables to store the last message
  let lastmsg = "";
  let src, newsrc = "";

  // Continuously fetch the page source until it stops changing
  while (true) {
    newsrc = await driver.getPageSource();
    if (src === newsrc) {
      break;
    } else {
      src = newsrc;
    }
    driver.sleep(1000);
  }

  // Parse the page source and extract the last message
  let root = htmlparser.parse(src);
  let out = root.querySelectorAll(".Markdown_markdownContainer__UyYrv");
  let lastbubble = out[out.length - 1].querySelectorAll("p");

  // Concatenate the last message contents into a string
  for (let k in lastbubble) {
    lastmsg += lastbubble[k];
    lastmsg += "\n";
  }

  // Clean up the last message by replacing specific HTML tags with their corresponding characters
  lastmsg = lastmsg.replaceAll("<em>", "*");
  lastmsg = lastmsg.replaceAll("</em>", "*");
  lastmsg = lastmsg.replaceAll("<p>", "");
  lastmsg = lastmsg.replaceAll("</p>", "");
  lastmsg = lastmsg.replaceAll(
    '<a node="[object Object]" class="MarkdownLink_linkifiedLink__KxC9G">',
    ""
  );
  lastmsg = lastmsg.replaceAll("</a>", "");

  // Output the cleaned-up last message for debugging purposes
  console.log(lastmsg);

  // Send the cleaned-up last message as a response
  res.send(lastmsg);
}

// Function to convert messages from POE format to OAI format
async function convertPOEtoOAI(messages) {
  // Output the input messages for debugging purposes
  console.log(`before split = ${messages}`);
  let messageout = messages;

  // If the messages contain a colon, split the string and take the portion after the colon
  if (messages.includes(":")) messageout = messages.split(":").splice(1);

  // Create a new response object in the OAI format
  let newresponse = {
    id: "chatcmpl-7ep1aerr8frmSjQSfrNnv69uVY0xM",
    object: "chat.completion",
    created: Date.now(),
    model: "gpt-3.5-turbo-0613",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: charname
            ? `${charname}: ${messageout}`
            : `${messageout}`,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 724,
      completion_tokens: 75,
      total_tokens: 799,
    },
  };

  // Output the processed message and the new response for debugging purposes
  console.log(`messageout : ${messageout}`);
  console.log(`newres : ${newresponse}`);

  // Return the new response object
  return newresponse;
}

// Function to convert messages from OAI format to POE format
async function convertOAIToPoe(messages) {
  console.log("oai to poe");

  // Initialize variables to store relevant information
  let newprompt = "";
  let systemsplit = messages[0].content.split("'s");
  let textfield = await driver.findElement(
    By.xpath(
      `//*[@id="__next"]/div[1]/div/section/div[2]/div/div/footer/div/div/div[1]/textarea`
    )
  );

  // Search for the character name in the system messages
  for (let sentence in systemsplit) {
    if (systemsplit[sentence].includes("Write ")) {
      charname = systemsplit[sentence].substring(
        6,
        systemsplit[sentence].length
      );
      break;
    }
  }

  // Prepare the system messages and set the character name
  let systemmsgs = "";
  console.log(`charname = ${charname}`);
  let aftersystem = false;

  // Loop through the messages to process and prepare the new prompt
  for (let i in messages) {
    console.log(messages[i]);
    if (messages[i].role === "system") {
      if (aftersystem) {
        newprompt += messages[i].content + "\n";
      } else {
        if (messages[i].name === "example_user")
          systemmsgs += `Your example message : ${messages[i].content} \n`;
        else if (messages[i].name === "example_assistant")
          systemmsgs += `${charname}'s example message : ${messages[i].content} \n`;
        else systemmsgs += `${messages[i].content}\n`;
      }
    }
    if (messages[i].role === "assistant") {
      aftersystem = true;
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

  // Clean up the system messages
  console.log("message dump done");
  let contentsplit = systemmsgs.split("\n");
  let bigMessage = contentsplit.join("\n");
  let characterName = bigMessage.match(/Character: "([^"]*)"/)[1];
  let userName = bigMessage.match(/User: "([^"]*)"/)[1];
  bigMessage = bigMessage.replace(/\[Start a new chat\]/g, "");
  console.log("Character Name:", characterName);
  console.log("User Name:", userName);
  await driver.executeScript(
    "arguments[0].value = arguments[1]",
    textfield,
    bigMessage
  );
  await textfield.sendKeys(
    `If you accept the requirements, please confirm by responding with "Understood." and nothing more. Once I receive your precise confirmation message, I will specify the context of the scene, as well as the characteristics, background, and personality of your character in the following message.`
  );
  await textfield.sendKeys(Key.ENTER);
  console.log("Send system message done");

  // Wait for the user to type "Understood." before proceeding
  let understoodDetected = false;
  while (!understoodDetected) {
    try {
      await driver.sleep(500);
      let src = await driver.getPageSource();
      let root = htmlparser.parse(src);
      let chatBreakButton = root.querySelector(
        ".ChatMessageInputFooter_chatBreakButton__hqJ3v"
      );
      let markdownContainer = root.querySelector(
        ".Markdown_markdownContainer__UyYrv"
      );
      if (
        (chatBreakButton && chatBreakButton.rawText.includes("Understood.")) ||
        (markdownContainer && markdownContainer.rawText.includes("Understood."))
      ) {
        understoodDetected = true;
      }
    } catch (err) {
      console.log(err.message);
    }
  }

  // Send the prepared prompt
  let splitedprompt = newprompt.split("\n");
  bigMessage = "[CHAT]\n" + splitedprompt.join("\n");
  bigMessage = bigMessage.replace(/DATA_1/g, characterName);
  bigMessage = bigMessage.replace(/DATA_2/g, userName);

  // Send the message by clicking the send button
  let buttonIsDisabled = true;
  while (buttonIsDisabled) {
    try {
      let button = await driver.findElement(
        By.css(
          ".Button_buttonBase__0QP_m.Button_primary__pIDjn.ChatMessageSendButton_sendButton__OMyK1.ChatMessageInputContainer_sendButton__s7XkP"
        )
      );
      buttonIsDisabled = await button.isEnabled() === false;
      if (buttonIsDisabled) {
        console.log("Button is disabled");
        await driver.sleep(100);
      } else {
        console.log("Button is enabled");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await driver.executeScript(
          "arguments[0].value = arguments[1]",
          textfield,
          bigMessage
        );

        const startTime = Date.now();
        while (Date.now() - startTime < 2000) {
          await textfield.sendKeys(Key.ENTER);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        console.log("Sending content");
      }
    } catch (error) {
      console.error(error);
    }
    if (buttonIsDisabled) {
    }
  }

  // Wait for the stop button to appear, indicating the message has been sent
  let buttonExists = false;
  while (!buttonExists) {
    try {
      await driver.findElement(
        By.css(
          ".Button_buttonBase__0QP_m.Button_tertiary__yq3dG.ChatStopMessageButton_stopButton__LWNj6"
        )
      );
      buttonExists = true;
      console.log("Button exists");
    } catch (error) {
      console.log("Button does not exist yet");
      await driver.sleep(1500);
    }
  }

  // Return the prepared prompt
  return newprompt;
}

// Function to handle completion requests using the Selenium WebDriver
async function sagedriverCompletion(req, res) {
  // Get the maximum token count from the request body
  let maxtoken = req.body.max_tokens;

  // Click the chat break button to start a new chat
  driver.findElement(By.className("ChatMessageInputFooter_chatBreakButton__hqJ3v")).click();

  // Convert messages from OAI format to POE format and await completion
  await convertOAIToPoe(req.body.messages);

  // Initialize variables to store the last message
  let lastmsg = "";
  let src, newsrc = "";

  // Wait until the stop button appears, indicating the completion is done
  while (true) {
    try {
      await driver.findElement(
        By.className(
          "Button_buttonBase__0QP_m Button_tertiary__yq3dG ChatStopMessageButton_stopButton__LWNj6"
        )
      );
    } catch (error) {
      break;
    }
  }

  // Fetch the page source and extract the last message
  while (true) {
    src = await driver.getPageSource();
    let root = htmlparser.parse(src);
    let out = root.querySelectorAll(".Markdown_markdownContainer__UyYrv");
    let lastbubble = out[out.length - 1].querySelectorAll("p");

    // Concatenate the last message contents into a string
    for (let k in lastbubble) {
      lastmsg += lastbubble[k].innerHTML;
      lastmsg += "\n";
    }

    // Clean up the last message by replacing specific HTML tags with their corresponding characters
    lastmsg = lastmsg.replaceAll("<em>", "*");
    lastmsg = lastmsg.replaceAll("</em>", "*");
    lastmsg = lastmsg.replaceAll("<br>", "");
    lastmsg = lastmsg.replaceAll("<p>", "");
    lastmsg = lastmsg.replaceAll("</p>", "");
    lastmsg = lastmsg.replaceAll(
      '<a node="[object Object]" class="MarkdownLink_linkifiedLink__KxC9G">',
      ""
    );
    lastmsg = lastmsg.replaceAll("</a>", "");
    lastmsg = lastmsg.replaceAll('<code node="[object Object]">', "");
    lastmsg = lastmsg.replaceAll("</code>", "");

    // Output a message for debugging purposes
    console.log("Proceeding to the next steps.");
    break;
  }

  // Convert the last message from POE format to OAI format and await the new response
  let newres = await convertPOEtoOAI(lastmsg, maxtoken);

  // If the new response is an object, convert it to a JSON string
  if (typeof newres == "object") {
    newres = JSON.parse(JSON.stringify(newres));
  }

  // Output the final result for debugging purposes
  console.log("Final result:", newres);

  // Send the new response as the completion result
  res.status(200).json(newres);
}

// Export the functions for use in other modules
export { sagedriverCompletion, test };