const { Expo } = require("expo-server-sdk");
let expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

/*
  [Format]  
  notifications :  [{token , notificationData}]
  If required notificationData can contain other details like title,body and data
*/
exports.sendNotification = catchAsync(async (req, res, next) => {
  const { notifications } = req.body;

  let messages = [];

  for (let i = 0; i < notifications.length; i++) {
    const { token, notificationData } = notifications[i];
    console.log(token);
    if (!Expo.isExpoPushToken(token)) {
      return next(new AppError("Invalid expo token", 401));
    }

    let message = {
      to: token,
      sound: "default",
      title: "New pickup",
      body: "there is a new pickup for you",
      data: notificationData,
    };

    messages.push(message);
  }

  const chunks = expo.chunkPushNotifications(messages);
  let tickets = [];

  for (let chunk of chunks) {
    let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...ticketChunk);
  }

  let receiptIds = [];
  let success = 0;
  let error = 0;

  for (let ticket of tickets) {
    console.log(ticket);
    if (ticket.id) {
      receiptIds.push(ticket.id);
    } else error++;
  }

  let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  for (let chunk of receiptIdChunks) {
    let receipts = await expo.getPushNotificationReceiptsAsync(chunk);

    for (let receiptId in receipts) {
      let { status, message, details } = receipts[receiptId];
      console.log(status);
      if (status == "ok") success++;
      else if (status == "error") error++;
    }
  }
  res.status(200).json({
    status: "success",
    successNotifications: success,
    errorNotifications: error,
  });
});
