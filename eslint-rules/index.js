// eslint-rules/index.js
// shared ESLint comment-style rules plugin

import fileHeader from './file-header.js'
import commentTags from './comment-tags.js'
import noUnicodeArrow from './no-unicode-arrow.js'
import plainCommentCase from './plain-comment-case.js'
import blockDocComments from './block-doc-comments.js'

export default {
  rules: {
    'file-header': fileHeader,
    'comment-tags': commentTags,
    'no-unicode-arrow': noUnicodeArrow,
    'plain-comment-case': plainCommentCase,
    'block-doc-comments': blockDocComments,
  },
}
