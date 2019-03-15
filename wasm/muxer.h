#ifndef MUXER_H
#define MUXER_H


#include <mkvparser/mkvparser.h>
#include <mkvmuxer/mkvmuxer.h>

namespace mux {

class Reader;
class Writer;

typedef int (*ReadCB)(unsigned char*, size_t, size_t);
typedef int (*LengthCB)(long long*, long long*);
typedef int64_t (*WriteCB)(const void*, size_t);
typedef int (*SeekCB)(size_t);
typedef int64_t (*PositionCB)();

using mkvmuxer::int32;
using mkvmuxer::uint32;
using mkvmuxer::int64;
using mkvmuxer::uint64;

class Reader : public mkvparser::IMkvReader {
public:
  Reader(ReadCB readCB_, LengthCB lengthCB_)
    : readCB(readCB_), lengthCB(lengthCB_) {}

  virtual int Read(long long pos, long len, unsigned char* buf);
  virtual int Length(long long* total, long long* available);

private:
  int readIntoBuffer();

  ReadCB readCB;
  LengthCB lengthCB;
};

class Writer : public mkvmuxer::IMkvWriter {
public:
  Writer(WriteCB writeCB_, SeekCB seekCB_, PositionCB posCB_)
    : writeCB(writeCB_), seekCB(seekCB_), posCB(posCB_) {}

  virtual int32 Write(const void* buf, uint32 len);
  virtual int64 Position() const;
  virtual int32 Position(int64 position);
  virtual bool Seekable() const;
  virtual void ElementStartNotify(uint64 element_id, int64 position);

private:
  WriteCB writeCB;
  SeekCB seekCB;
  PositionCB posCB;
};

} //namespace mux


#endif //#ifndef MUXER_H
