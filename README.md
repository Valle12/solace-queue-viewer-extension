# solace-queue-viewer-extension

This chrome extension allows you to view messages received on [Solace PubSub+](https://solace.com/products/event-broker/software/) directly in their respective message queues in the browser. This whole project was inspired by [solace-queue-browser-extension](https://github.com/solacecommunity/solace-queue-browser-extension), but I tried to make it into a more robust piece of software.

## Features

- Type safe development with TypeScript
- Unit Testing
- Manual extraction and usage of cluster credentials for message retrieval
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

   ![Start Button](/images/injectedStartButton.png)

9. If you click on the start button, the extension will start extracting messages (it will still be active, even if you paginate) and change the button to the stop icon
10. You can click on any of the messages and additionally to the default information displayed in the expansion panel, you can now also see the message content and topic of the specific message
11. At any point in time, you can also stop the extraction with clicking on the stop button

    ![Stop Button](/images/injectedStopButton.png)

    But remember, all of the already extracted messages will still remain in memory and you can still see them in the expanded message view. They will be overwritten once you start the process again

## TODO

- [ ] Publish extension to extension store
- [ ] Error handling (e.g. solclientjs refuses to establish connection)
- [ ] Get Debugger to work in VS Code
- [ ] Check for possible different urls to start from (e.g. production-console.solace.cloud)
- [ ] Implement E2E Testing
