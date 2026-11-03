<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
const props=defineProps({ text: {type:String,default:''} })
const html=computed(()=>DOMPurify.sanitize(marked.parse(props.text,{breaks:true}),{FORBID_TAGS:['img','iframe','video','audio','style','form','input','button'],FORBID_ATTR:['style']}))
</script>
<template><div class="result-text result-markdown" v-html="html"/></template>
