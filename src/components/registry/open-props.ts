// src/components/registry/open-props.ts
// canonical open-prop policy evaluation for component metadata consumers

import type { ComponentOpenPropsPolicy } from './types'

const DOM_PROP_NAMES = new Set([
  'about',
  'accessKey',
  'autoCapitalize',
  'autoCorrect',
  'autoFocus',
  'autoSave',
  'class',
  'className',
  'color',
  'content',
  'contentEditable',
  'contextMenu',
  'dangerouslySetInnerHTML',
  'datatype',
  'defaultChecked',
  'defaultValue',
  'dir',
  'draggable',
  'enterKeyHint',
  'exportparts',
  'hidden',
  'id',
  'inert',
  'inlist',
  'inputMode',
  'is',
  'itemID',
  'itemProp',
  'itemRef',
  'itemScope',
  'itemType',
  'key',
  'lang',
  'nonce',
  'part',
  'popover',
  'popoverTarget',
  'popoverTargetAction',
  'prefix',
  'property',
  'radioGroup',
  'ref',
  'rel',
  'resource',
  'results',
  'rev',
  'role',
  'security',
  'slot',
  'spellCheck',
  'style',
  'suppressContentEditableWarning',
  'suppressHydrationWarning',
  'tabIndex',
  'title',
  'translate',
  'typeof',
  'unselectable',
  'vocab',
])

const EVENT_PROP = /^on[A-Z]/

export function isOpenComponentProp(
  name: string,
  policy: ComponentOpenPropsPolicy | undefined
): boolean
{
  if (!policy)
  {
    return false
  }

  return (
    policy.unknown === true ||
    (policy.dom === true && DOM_PROP_NAMES.has(name)) ||
    (policy.dataAttributes === true && name.startsWith('data-')) ||
    (policy.ariaAttributes === true && name.startsWith('aria-')) ||
    (policy.eventHandlers === true && EVENT_PROP.test(name))
  )
}
