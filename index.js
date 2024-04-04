
const express = require("express");
const bodyParser = require("body-parser");
const { GraphQLClient } = require('graphql-request');
const { gql } = require('graphql-request');
require('dotenv').config();
const http = require('http');
const https = require('https');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT;

app.use(cors());
axios.defaults.headers.common['Authorization'] = process.env.IMAGGA_TOKEN;
const hygraph = new GraphQLClient(
  process.env.GRAPHCMS_INSTANCE,
    {
      headers: {
        Authorization: process.env.GRAPHCMS_TOKEN
      }
    }
  );

app.use(bodyParser.json());

app.post("/", (req, res) => {
  console.log(req.body); 

  res.status(200).end();

  updateAssetTags(req.body);
});

app.get("/", (req, res) => {
  console.log(req.body); 
  res.status(200).end();
  res.body = "asd";
});

const updateAssetTags = async (variables) => {
    console.log("Get Asset Details");
    const query = gql`
        query GetQueryURL($id: ID!) {
            asset(where: {id: $id})
            {
                url
                fileName
                id
                smartTags
            }
        }
    `;
    
    const id = variables.data.id;
    const { asset } = await hygraph.request(query, { id });

    console.log("Got Asset Details");

    ApplyAssetTagsFromImagga(asset);
}

const ApplyAssetTagsFromImagga = async (asset) => {
    console.log("Get tags");
    console.log(asset);

    if(asset){
        var assetURL = asset.url;
        var fileName = asset.fileName;
        var assetId = asset.id;
        var smartTags = asset.smartTags;
        
        if(fileName.endsWith(".jpg") || fileName.endsWith(".png")|| fileName.endsWith(".jpeg") || fileName.endsWith(".webp")){
            axios.get('https://api.imagga.com/v2/tags?image_url=' + assetURL + '&threshold=25')
                .then(response => {
                    ApplyTags(response.data.result.tags, asset);
                })
                .catch(error => {
                    console.log(error);
                });
        }
    }
};

const ApplyTags = async (tagArray, asset, treshold = 20.0) => {
    console.log("Apply tags");

    var tags = asset.smartTags;
    var id = asset.id;
    var shouldMutate = false;
    
    tagArray.forEach((value, index, array)=>{
        if(value.confidence >= treshold && !asset.smartTags.includes(value.tag.en)){
            tags.push(value.tag.en);
            shouldMutate = true;
        }
    });

    var mutation = gql`
    mutation AddAssetSmartTags($id:ID!, $tags:[String!]) {
        updateAsset(
          data: {smartTags: $tags}
          where: {id: $id}
        ) {
          id
        }
      }
    `;
    try {

      if(shouldMutate){
        var { assetResult } = await hygraph.request(mutation, { id, tags });
        console.log("mutation sent");
      }
    }
    catch(error){
      console.error(error);
    }
};

module.exports = app;
// Start express on the defined port
app.listen(PORT, console.log(`🚀 Server running on port ${PORT}`))