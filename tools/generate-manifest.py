#! /usr/bin/env python3

"""
Create browser specific manifest.
Expects to be run from toplevel dir (where manifest.json file is).
"""

import os
import sys
import json
from collections import OrderedDict

if len(sys.argv) < 2:
    print("Expecting 1 argument: platform name")
    sys.exit(1)

PLATFORM = sys.argv[1]
PWD = os.getcwd()
MAN_PATH = os.path.abspath("{}/manifest.json".format(PWD))
PLAT_MAN_PATH = os.path.abspath("{}/platform/{}/manifest.json".format(PWD, PLATFORM))
PLAT_OUT_MAN_PATH = os.path.abspath("{}/platform/{}-dev/manifest.json".format(PWD, PLATFORM))

def is_obj(obj):
    """Is argument a JSON object (dict or OrderedDict)."""
    return type(obj) == type({}) or type(obj) == type(OrderedDict())

def is_array(arr):
    """Is argument a JSON array (list)."""
    return type(arr) == type([])

def merge_json(json_doc_1, json_doc_2):
    """Appends json_doc_2 to json_doc_1. At each nesting level, if json_doc_1
doesn't contain a key in json_doc_2, the key from json_doc_2 is assigned to
json_doc_1. If identical keys are present, add the unique keys of json_doc_2
to json_doc_1. If the keys are present in both and are arrays, the values
in json_doc_2 are added to json_doc_1. If the same key is present in both
and is not an object, it is not updated in json_doc_1."""
    for key, val in json_doc_2.items():
        if not key in json_doc_1:
            json_doc_1[key] = json_doc_2[key]
        elif is_obj(json_doc_2[key]) and is_obj(json_doc_1[key]):
            merge_json(json_doc_1[key], json_doc_2[key])
        elif is_array(json_doc_2[key]) and is_array(json_doc_1[key]):
            json_doc_1[key].extend(json_doc_2[key])

def main():
    with open(MAN_PATH, "r") as fp:
        json_manifest = json.load(fp, object_pairs_hook=OrderedDict)

    with open(PLAT_MAN_PATH, "r") as fp:
        ff_json_manifest = json.load(fp, object_pairs_hook=OrderedDict)

    merge_json(json_manifest, ff_json_manifest)

    with open(PLAT_OUT_MAN_PATH, "w") as fp:
        json.dump(json_manifest, fp, indent=2)

if __name__ == '__main__':
    main()
