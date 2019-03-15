#ifndef MUXER_CPP
#define MUXER_CPP


#include "muxer.h"

#include <iostream>

namespace mux {

/* Reader */

int Reader::Read(long long pos, long len, unsigned char* buf) {
  if (pos < 0 || len < 0) {
    return -1;
  }

  long ret = readCB(buf, len, pos);
  if (ret < len) {
    return -1;
  }

  return 0;
}

int Reader::Length(long long* total, long long* available) {
  int ret = lengthCB(total, available);
  if (ret) {
    return -1;
  }

  return 0;
}

/* Writer */

int32 Writer::Write(const void* buf, uint32 len) {
  if (!len) {
    return 0;
  } else if (!buf) {
    return -1;
  }

  int64_t ret = writeCB(buf, len);
  if (ret < 0 || uint32(ret) < len) {
    return -1;
  }

  return 0;
}

int64 Writer::Position() const {
  return posCB();
}

int32 Writer::Position(int64 pos) {
  if (pos < 0) {
    return -1;
  }

  return seekCB(pos);
}

bool Writer::Seekable() const {
  return true;
}

void Writer::ElementStartNotify(uint64, int64) {

}

} //namespace mux


#endif //#ifndef MUXER_CPP
