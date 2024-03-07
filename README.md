# solace-queue-viewer-extension

This chrome extension allows you to view messages received on [Solace PubSub+](https://solace.com/products/event-broker/software/) directly in their respective message queues in the browser. This whole project was inspired by [solace-queue-browser-extension](https://github.com/solacecommunity/solace-queue-browser-extension), but I tried to make it into a more robust piece of software.

## Installation

Right now you can only use the extension locally, but it is planned to also provide it via the chrome extension store. Because the whole extension is written in TypeScript, you need to compile it yourself in order to create the dist folder, which you can use to enable the extension inside the browser.

```bash
git clone git@github.com:Valle12/solace-queue-viewer-extension.git
cd solace-queue-viewer-extension
npm install
npm build
```

After those steps you will have a dist folder, which you can use to activate the extension locally.

1. Open **Extensions** panel
2. Enable **Developer Mode**
3. Click on **Load unpacked**
4. Select **dist** folder
5. Your extension is now activated

## Features

- Type safe development with TypeScript
- Unit Testing
- Automatic extraction and usage of cluster credentials for message retrieval
- Injection of button on message tab to start/stop the process
- Inline injection of message content and topic on every message
- New messages will also be extracted and injected correctly as long as the process is running
- Hassle free change of clusters

## How to use

I want to demonstrate, how a typical interaction with the extension works.

1. Start on [Solace](https://console.solace.cloud/)
2. Click on **Cluster Manager**
3. Select Cluster
4. Click on **Manage**
5. Click on **Queues**
6. Select Queue
7. Click on **Messages Queued**
8. You will see the new start button injected in the top right corner
   ![[images/injectedStartButton.png]]
9. If you click on the start button, the extension will start extracting messages (it will still be active, even if you paginate) and change the button to the stop icon
10. You can click on any of the messages and additionally to the default information displayed in the expansion panel, you can now also see the message content and topic of the specific message
11. At any point in time, you can also stop the extraction with clicking on the stop button
    ![[images/injectedStopButton.png]]
    But remember, all of the already extracted messages will still remain in memory and you can still see them in the expanded message view. They will be overwritten once you start the process again

## TODO

- [ ] Publish extension to extension store
- [ ] Error handling (e.g. solclientjs refuses to establish connection)
- [ ] Get Debugger to work in VS Code
- [ ] Check for possible different urls to start from (e.g. production-console.solace.cloud)
- [ ] Implement E2E Testing
