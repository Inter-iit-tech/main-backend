const { Expo } = require("expo-server-sdk");
let expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

exports.sendNotification = catchAsync(async (req, res, next) => {
  const { token, notificationData } = req.body;
  console.log({ token, notificationData });

  if (!token || !notificationData) {
    return next(new AppError("Token or data is missing", 401));
  }
  if (!Expo.isExpoPushToken(token)) {
    return next(new AppError("Invalid expo token", 401));
  }
  let messages = [
    {
      to: token,
      sound: "default",
      title: "New pickup",
      body: "there is a new pickup for you",
      data: notificationData,
    },
  ];

  //   let chunks = expo.chunkPushNotifications(messages);
  let ticketChunk = await expo.sendPushNotificationsAsync(messages);

  //   let receipt = await expo.getPushNotificationReceiptsAsync
  res.status(200).json({
    status: "success",
  });
});
