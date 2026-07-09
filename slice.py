import sys

path = 'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/BoardPage/BoardPageContent.jsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = lines[:212] + lines[218:]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Done slicing!")
