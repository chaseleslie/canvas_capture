#include "muxer.h"

#include <mkvparser/mkvparser.h>
#include <mkvparser/mkvreader.h>
#include <mkvmuxer/mkvmuxer.h>
#include <mkvmuxer/mkvwriter.h>
#include <common/hdr_util.h>

#include <iostream>
#include <memory>

using namespace mux;

extern "C" {

const char* const WRITING_APP = "Canvas Capture";

int webm_muxer(ReadCB readCB, LengthCB lengthCB, WriteCB writeCB, SeekCB seekCB, PositionCB posCB) {
  Reader reader(readCB, lengthCB);
  Writer writer(writeCB, seekCB, posCB);

  long long pos = 0;
  mkvparser::EBMLHeader header;
  long long ret = header.Parse(&reader, pos);
  if (ret < 0) {
    std::cerr << "Error: mkvparser::EBMLHeader::Parse(): " << ret << std::endl;
    return 1;
  }

  mkvparser::Segment* parserSegment_ = nullptr;
  ret = mkvparser::Segment::CreateInstance(&reader, pos, parserSegment_);
  if (ret) {
    std::cerr << "Error: mkvparser::Segment::CreateInstance(): " << ret << std::endl;
    return 1;
  }
  std::unique_ptr<mkvparser::Segment> parserSegment(parserSegment_);
  ret = parserSegment->Load();
  if (ret < 0) {
    std::cerr << "Error: mkvparser::Segment::Load(): " << ret << std::endl;
    return 1;
  }

  const mkvparser::SegmentInfo* const parserSegmentInfo = parserSegment->GetInfo();
  if (!parserSegmentInfo) {
    std::cerr << "Error: mkvparser::Segment::Load(): " << ret << std::endl;
    return 1;
  }
  const long long timeCodeScale = parserSegmentInfo->GetTimeCodeScale();

  mkvmuxer::Segment muxerSegment;
  if (!muxerSegment.Init(&writer)) {
    std::cerr << "Error: mkvmuxer::Segment::Init(): " << ret << std::endl;
    return 1;
  }
  muxerSegment.AccurateClusterDuration(true);
  muxerSegment.UseFixedSizeClusterTimecode(false);
  muxerSegment.set_mode(mkvmuxer::Segment::kFile);
  muxerSegment.SetChunking(false, nullptr);
  muxerSegment.OutputCues(true);
  mkvmuxer::SegmentInfo* const muxerSegmentInfo = muxerSegment.GetSegmentInfo();
  muxerSegmentInfo->set_timecode_scale(timeCodeScale);
  muxerSegmentInfo->set_writing_app(WRITING_APP);

  const mkvparser::Tags* const tags = parserSegment->GetTags();
  if (tags) {
    for (size_t k = 0, n = tags->GetTagCount(); k < n; k += 1) {
      const mkvparser::Tags::Tag* const parserTag = tags->GetTag(k);
      mkvmuxer::Tag* muxerTag = muxerSegment.AddTag();

      for (size_t iK = 0, iN = parserTag->GetSimpleTagCount(); iK < iN; iK += 1) {
        const mkvparser::Tags::SimpleTag* const parserSimpleTag = parserTag->GetSimpleTag(iK);
        muxerTag->add_simple_tag(
          parserSimpleTag->GetTagName(),
          parserSimpleTag->GetTagString()
        );
      }
    }
  }

  const mkvparser::Tracks* const parserTracks = parserSegment->GetTracks();
  const int kVideoTrackNumber = 0;
  const int kAudioTrackNumber = 0;
  uint64_t vTrack = 0;
  uint64_t aTrack = 0;
  for (size_t k = 0, n = parserTracks->GetTracksCount(); k < n; k += 1) {
    unsigned long trackNum = k;
    const mkvparser::Track* const parserTrack = parserTracks->GetTrackByIndex(trackNum);
    if (!parserTrack) {
      continue;
    }

    const char* const trackName = parserTrack->GetNameAsUTF8();
    const long long trackType = parserTrack->GetType();

    if (trackType == mkvparser::Track::kVideo) {
      const mkvparser::VideoTrack* const parserVideoTrack =
        static_cast<const mkvparser::VideoTrack*>(parserTrack);
      const long long width = parserVideoTrack->GetWidth();
      const long long height = parserVideoTrack->GetHeight();

      vTrack = muxerSegment.AddVideoTrack(
        static_cast<int>(width),
        static_cast<int>(height),
        kVideoTrackNumber
      );

      if (!vTrack) {
        std::cerr << "Error: mkvmuxer::Segment::AddVideoTrack()" << std::endl;
        return 1;
      }

      mkvmuxer::VideoTrack* const muxerVideoTrack = static_cast<mkvmuxer::VideoTrack*>(
        muxerSegment.GetTrackByNumber(vTrack)
      );
      if (!muxerVideoTrack) {
        std::cerr << "Error: mkvmuxer::Segment::GetTrackByNumber()" << std::endl;
        return 1;
      }

      if (parserVideoTrack->GetColour()) {
        mkvmuxer::Colour muxerColor;
        if (!libwebm::CopyColour(*parserVideoTrack->GetColour(), &muxerColor)) {
          std::cerr << "Error: libwebm::CopyColour()" << std::endl;
          return 1;
        }
        if (!muxerVideoTrack->SetColour(muxerColor)) {
          std::cerr << "Error: mkvmuxer::VideoTrack::SetColour()" << std::endl;
          return 1;
        }
      }

      if (trackName) {
        muxerVideoTrack->set_name(trackName);
      }

      muxerVideoTrack->set_codec_id(parserVideoTrack->GetCodecId());

      const double frameRate = parserVideoTrack->GetFrameRate();
      if (frameRate > 0.0) {
        muxerVideoTrack->set_frame_rate(frameRate);
      }
    } else if (trackType == mkvparser::Track::kVideo) {
      const mkvparser::AudioTrack* const parserAudioTrack =
          static_cast<const mkvparser::AudioTrack*>(parserTrack);
      const long long numChannels = parserAudioTrack->GetChannels();
      const double sampleRate = parserAudioTrack->GetSamplingRate();

      aTrack = muxerSegment.AddAudioTrack(
        static_cast<int>(sampleRate),
        static_cast<int>(numChannels),
        kAudioTrackNumber
      );
      if (!aTrack) {
        std::cerr << "Error: mkvmuxer::Segment::AddAudioTrack()" << std::endl;
        return 1;
      }

      mkvmuxer::AudioTrack* const muxerAudioTrack =
          static_cast<mkvmuxer::AudioTrack*>(muxerSegment.GetTrackByNumber(aTrack));
      if (!muxerAudioTrack) {
        std::cerr << "Error: mkvmuxer::Segment::GetTrackByNumber()" << std::endl;
        return 1;
      }

      if (trackName) {
        muxerAudioTrack->set_name(trackName);
      }

      muxerAudioTrack->set_codec_id(parserAudioTrack->GetCodecId());

      size_t privateSize;
      const unsigned char* const privateData =
          parserAudioTrack->GetCodecPrivate(privateSize);
      if (privateSize > 0) {
        if (!muxerAudioTrack->SetCodecPrivate(privateData, privateSize)) {
          std::cerr << "Error: mkvmuxer::AudioTrack::SetCodecPrivate()" << std::endl;
          return 1;
        }
      }

      const long long bitDepth = parserAudioTrack->GetBitDepth();
      if (bitDepth > 0) {
        muxerAudioTrack->set_bit_depth(bitDepth);
      }

      if (parserAudioTrack->GetCodecDelay()) {
        muxerAudioTrack->set_codec_delay(parserAudioTrack->GetCodecDelay());
      }

      if (parserAudioTrack->GetSeekPreRoll()) {
        muxerAudioTrack->set_seek_pre_roll(parserAudioTrack->GetSeekPreRoll());
      }
    }
  }

  mkvmuxer::Cues* const muxerCues = muxerSegment.GetCues();
  muxerCues->set_output_block_number(true);
  if (vTrack) {
    muxerSegment.CuesTrack(vTrack);
  }
  if (aTrack) {
    muxerSegment.CuesTrack(aTrack);
  }

  unsigned char* data = nullptr;
  size_t dataLen = 0;
  const mkvparser::Cluster* parserCluster = parserSegment->GetFirst();

  while (parserCluster && !parserCluster->EOS()) {
    const mkvparser::BlockEntry* parserBlockEntry;

    long status = parserCluster->GetFirst(parserBlockEntry);
    if (status) {
      std::cerr << "Error: mkvparser::Cluster::GetFirst(): " << status << std::endl;
      return 1;
    }

    while (parserBlockEntry && !parserBlockEntry->EOS()) {
      const mkvparser::Block* const parserBlock = parserBlockEntry->GetBlock();
      const long long trackNum = parserBlock->GetTrackNumber();
      const mkvparser::Track* const parserTrack =
          parserTracks->GetTrackByNumber(static_cast<unsigned long>(trackNum));

      if (!parserTrack) {
        std::cerr << "Error: mkvparser::Tracks::GetTrackByNumber()" << std::endl;
        return 1;
      }

      const long long parserTrackType = parserTrack->GetType();
      const long long parserTimeNS = parserBlock->GetTime(parserCluster);

      if (
        parserTrackType == mkvparser::Track::kAudio ||
        parserTrackType == mkvparser::Track::kVideo
      ) {
        const size_t parserFrameCount = parserBlock->GetFrameCount();

        for (size_t k = 0; k < parserFrameCount; k += 1) {
          const mkvparser::Block::Frame& parserFrame = parserBlock->GetFrame(k);

          if (size_t(parserFrame.len) > dataLen) {
            delete[] data;
            data = new (std::nothrow) unsigned char[parserFrame.len];
            if (!data) {
              std::cerr << "Error: new[]" << std::endl;
              return 1;
            }
            dataLen = parserFrame.len;
          }

          if (parserFrame.Read(&reader, data)) {
            std::cerr << "Error: mkvparser::Block::Frame::Read()" << std::endl;
            return 1;
          }

          mkvmuxer::Frame muxerFrame;
          if (!muxerFrame.Init(data, parserFrame.len)) {
            std::cerr << "Error: mkvmuxer::Frame::Init()" << std::endl;
            return 1;
          }
          muxerFrame.set_track_number(
            parserTrackType == mkvparser::Track::kAudio ? aTrack : vTrack
          );

          if (parserBlock->GetDiscardPadding()) {
            muxerFrame.set_discard_padding(parserBlock->GetDiscardPadding());
          }

          muxerFrame.set_timestamp(parserTimeNS);
          muxerFrame.set_is_key(parserBlock->IsKey());

          if (!muxerSegment.AddGenericFrame(&muxerFrame)) {
            std::cerr << "Error: mkvmuxer::Segment::AddGenericFrame()" << std::endl;
            return 1;
          }
        }
      }

      status = parserCluster->GetNext(parserBlockEntry, parserBlockEntry);
      if (status) {
        std::cerr << "Error: mkvparser::Cluster::GetNext(): " << status << std::endl;
        return 1;
      }

    }

    parserCluster = parserSegment->GetNext(parserCluster);
  }

  if (!muxerSegment.Finalize()) {
    std::cerr << "Error: mkvmuxer::Segment::Finalize()" << std::endl;
    return 1;
  }

  delete[] data;

  return 0;
}

} // extern "C"
