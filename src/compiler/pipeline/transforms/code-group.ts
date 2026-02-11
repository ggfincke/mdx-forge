// src/compiler/pipeline/transforms/code-group.ts
// transform CodeGroup component to semantic HTML

import type { RootContent } from 'mdast';
import type { MdxJsxElement } from '../../types';
import { createNode, createTrustedModeNotice } from './utils';
import {
  SAFE_CODE_GROUP,
  SAFE_CODE_GROUP_NOTICE,
  SAFE_CODE_GROUP_CONTENT,
} from '../../internal/css-classes';

// transform CodeGroup container component to semantic HTML (non-interactive in Safe Mode)
export function transformCodeGroup(node: MdxJsxElement): RootContent {
  return createNode({
    type: 'codeGroup',
    hName: 'div',
    className: SAFE_CODE_GROUP,
    children: [
      createTrustedModeNotice(
        SAFE_CODE_GROUP_NOTICE,
        'Code group (tabbed view requires Trusted Mode)'
      ),
      createNode({
        type: 'codeGroupContent',
        hName: 'div',
        className: SAFE_CODE_GROUP_CONTENT,
        children: node.children,
      }),
    ],
  });
}
