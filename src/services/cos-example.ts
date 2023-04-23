/* istanbul ignore file */
/*
 *  This is an example of the COS handler instance.
 *
 *  package json dependency must include this line
 *     "@symposium/usage-common": "0.x.x",
 *
 *   There is a loader that loads a single instance.
 *   The sample is run from server.ts has runCosExample()
 */

import { logger } from '@symposium/usage-common';
import { cosHandlerInstance } from '../loaders/cos-loader';

export const runCosExample = async () => {
  const fileName = `upload-${Date.now()}`;

  const exp1BucketName = 'customer-bucket';

  try {
    // Bucket Tests: Create and Exist
    // await cosHandlerInstance.createBucket('test-bucket');

    console.log('%%%%%%%%%%%%%%%%%%%%% EXAMPLE 1 %%%%%%%%%%%%%%%%%%%%%');
    logger.verbose(`**** COS Example 1 write object fileName: ${fileName}`);
    await cosHandlerInstance.writeObjWithMultiTenancy(exp1BucketName, fileName, 'Upload string no tenant');

    logger.verbose(`**** COS Example 1a write object fileName: ${fileName}-1a`);
    await cosHandlerInstance.writeObjWithMultiTenancy(exp1BucketName, `${fileName}-1a`, 'Upload string no tenant');

    console.log('%%%%%%%%%%%%%%%%%%%%% EXAMPLE 2 %%%%%%%%%%%%%%%%%%%%%');
    const exp2BucketName = 'bucket-2';
    const exp2FileName = `${fileName}-2`;
    const exp2Prefix = 'testAccount';

    logger.verbose(`**** COS Example 2 write object fileName: ${exp2FileName}`);
    await cosHandlerInstance.writeObjWithMultiTenancy(
      exp2BucketName,
      exp2FileName,
      { prop1: 'testProp1', prop2: 'testProp2', prop3: 'testProp2' },
      exp2Prefix
    );
    logger.verbose(`**** COS Example get object: ${exp2FileName}`);
    const fileReturned1 = await cosHandlerInstance.getObject(exp2BucketName, exp2FileName, exp2Prefix);
    logger.verbose(`**** COS Example fileReturened: ${fileReturned1.toString()}`);
  } catch (error) {
    logger.error(`COS Example: `, error);
  }

  console.log('%%%%%%%%%%%%%%%%%%%%% EXAMPLE 3 %%%%%%%%%%%%%%%%%%%%%');
  const exp3BucketName = 'customer-bucket';
  const exp3FileName = `customerAccount/${fileName}-3`;
  try {
    //upload and get with a prefix
    logger.verbose(`**** COS Example 3 write object fileName: ${exp3FileName}`);
    await cosHandlerInstance.writeObjWithMultiTenancy(exp3BucketName, exp3FileName, 'Example uploaded string doc');

    logger.verbose(`**** COS Example get object: ${exp3FileName}`);
    const fileReturened = await cosHandlerInstance.getObject(exp3BucketName, exp3FileName);
    logger.verbose(`**** COS Example fileReturened: ${fileReturened.toString()}`);
  } catch (error) {
    logger.error(`COS Example3: `, error);
  }

  try {
    console.log('%%%%%%%%%%%%%%%%%%%%% EXAMPLE 4 Delete %%%%%%%%%%%%%%%%%%%%%');
    const deleteresult = await cosHandlerInstance.deleteObject(exp1BucketName, `${fileName}-1a`);
    logger.verbose(`**** COS Example deleteresult: ${deleteresult}`);
  } catch (error) {
    logger.error(`COS Example4 Delete: `, error);
  }

  try {
    const results = await cosHandlerInstance.copyObject(exp1BucketName, `${exp1BucketName}-copy`, fileName, fileName);
    logger.verbose(`**** COS Example copyItem: `, results);

    const results2 = await cosHandlerInstance.copyObject(
      exp3BucketName,
      `${exp3BucketName}-copy`,
      exp3FileName,
      exp3FileName
    );
    logger.verbose(`**** COS Example copyObject multiTenant: `, results2);
  } catch (error) {
    logger.error(`COS Example copyObject: `, error);
  }

  // get list of objects in bucket
  try {
    const results = await cosHandlerInstance.getListOBucketObjects(exp1BucketName);
    logger.verbose(`**** COS Example getListOBucketObjects: `, results);
  } catch (error) {
    logger.error(`COS getListOBucketObjects: `, error);
  }

  try {
    const results = await cosHandlerInstance.listBuckets();
    logger.verbose(`**** COS Example listBuckets: `, results);
  } catch (error) {
    logger.error(`COS Example listBuckets: `, error);
  }

  try {
    const results = await cosHandlerInstance.moveObject(
      exp1BucketName,
      `${exp1BucketName}-archive`,
      fileName,
      fileName
    );
    logger.verbose(`**** COS Example listBuckets: `, results);
  } catch (error) {
    logger.error(`COS Example archive object: `, error);
  }
};
