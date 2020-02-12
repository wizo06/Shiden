/**
 * @module worker
 * This module handles processing jobs from the queue
 */

// Import node modules
const path = require('path');

// Import custom modules
const logger = require(path.join(process.cwd(), 'src/utils/logger.js'));
const queueHandler = require(path.join(process.cwd(), 'src/utils/queueHandler.js'));
const rclone = require(path.join(process.cwd(), 'src/automata/rclone.js'));
const tempHandler = require(path.join(process.cwd(), 'src/utils/tempHandler.js'));
const pipeline = require(path.join(process.cwd(), 'src/pipeline.js'));
const notification = require(path.join(process.cwd(), 'src/automata/notification.js'));

module.exports = processNextJob = async () => {
  try {
    // Step 0 Retrieve next job
    const job = queueHandler.getFirstJob();

    // Step 1 Download
    logger.info('[1/4] Downloading');
    await rclone.download(job);

    // Step 2 Hardsub
    logger.info(['[2/4] Transcoding'])
    await pipeline.x264(job);

    // Step 3 Upload
    await rclone.upload(job);

    // Step 4 Notify
    await notification.send(job, undefined);

    // Delete files in folder/
    tempHandler.destroy();

    // Remove current job out of queue
    queueHandler.removeFirstJobFromQueue();

    // Check if queue has jobs and recursively process next job
    if (!queueHandler.isEmpty()) processNextJob();
  }
  catch (errorCode) {
    // Log the error code from step 1, 2 and/or 3
    logger.error(errorCode);

    // Step 4 Notify
    await notification.send(job, errorCode);

    // Delete files in folder/
    tempHandler.destroy();

    // Remove current job out of queue
    queueHandler.removeFirstJobFromQueue();
  }
};