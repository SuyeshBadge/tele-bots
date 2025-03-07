#!/usr/bin/env python3

import ast
import re

# Test with a simple array
test_array = ['🌟 First item', '🎯 Second item', '📱 Third item']
print('Original array:', test_array)

# Convert to string representation (this is what happens if str() is used)
array_as_string = str(test_array)
print('Array as string:', array_as_string)

# Proper joining
joined_string = '\n\n'.join(test_array)
print('Properly joined string:')
print(joined_string)

# Now test our string parsing for array-like strings
print('\nTesting array-like string parsing:')
content = array_as_string

if isinstance(content, str) and content.startswith('[') and content.endswith(']'):
    print('String looks like an array, attempting to parse...')
    try:
        content_array = ast.literal_eval(content)
        print('Successfully parsed back to array:', content_array)
        joined = '\n\n'.join(content_array)
        print('Joined properly:')
        print(joined)
    except Exception as e:
        print('Parse error:', e)
        # Fallback: strip brackets and replace comma-quote patterns
        content = content[1:-1].replace("', '", '\n\n').replace("'", '')
        print('Manual cleanup:')
        print(content) 